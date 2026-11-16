using System.Collections.Concurrent;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using BIMLogLensNext;

namespace BIMLogLensNext.Revit2026;

public sealed class LensNextRevitBindingFile
{
    public int ProjectId { get; set; }
    public string DocumentGuid { get; set; } = "";
    public string? CentralModelGuid { get; set; }
    public string FileNameNormalized { get; set; } = "";
    public double[] NavisworksToRevitTransform { get; set; } = Array.Empty<double>();
    public List<long> RevitElementIds { get; set; } = new();
}

public sealed class LensNextRevitExternalEventHandler : IExternalEventHandler
{
    private readonly ConcurrentQueue<Action<UIApplication>> _jobs = new();
    public string GetName() => "BIMLog Lens Next Revit navigation";
    public void Execute(UIApplication application) { while (_jobs.TryDequeue(out var job)) job(application); }
    public void Enqueue(Action<UIApplication> job) => _jobs.Enqueue(job);
}

public sealed class LensNextRevitBridgeHost : IDisposable
{
    private readonly HttpListener _listener = new();
    private readonly LensNextRevitBridgeSecurity _security = new(new[]{"https://bimlog.app","http://localhost:5000","http://127.0.0.1:5000"});
    private readonly LensNextRevitExternalEventHandler _handler;
    private readonly ExternalEvent _externalEvent;
    private readonly JsonSerializerOptions _json = new(){PropertyNameCaseInsensitive=true,PropertyNamingPolicy=JsonNamingPolicy.CamelCase};
    private LensNextRevitBridgeSession? _session;
    private CancellationTokenSource? _cancellation;

    public LensNextRevitBridgeHost(LensNextRevitExternalEventHandler handler, ExternalEvent externalEvent) { _handler=handler;_externalEvent=externalEvent;_listener.Prefixes.Add("http://127.0.0.1:8876/"); }
    public void Start(){_cancellation=new CancellationTokenSource();_listener.Start();_ = Task.Run(()=>Listen(_cancellation.Token));}
    public void Dispose(){_cancellation?.Cancel();if(_listener.IsListening)_listener.Stop();_listener.Close();}

    private async Task Listen(CancellationToken cancellation){while(!cancellation.IsCancellationRequested){HttpListenerContext context;try{context=await _listener.GetContextAsync();}catch when(cancellation.IsCancellationRequested){return;}_=Task.Run(()=>Handle(context),cancellation);}}
    private async Task Handle(HttpListenerContext context){try{
      var request=context.Request;var origin=(request.Headers["Origin"]??"").TrimEnd('/');Cors(context.Response,origin);
      if(request.HttpMethod=="OPTIONS"){context.Response.StatusCode=204;context.Response.Close();return;}
      if(request.Url?.AbsolutePath=="/v1/session"&&request.HttpMethod=="GET"){_session=_security.IssueSession(origin,DateTimeOffset.UtcNow);await Write(context.Response,200,new{success=true,payload=new{token=_session.Token,sessionId=_session.SessionId,expiresAt=_session.ExpiresAt}});return;}
      _security.ValidateRead(origin,Bearer(request.Headers["Authorization"]),_session!,DateTimeOffset.UtcNow);
      if(request.Url?.AbsolutePath=="/v1/model-binding"&&request.HttpMethod=="GET"){var projectId=int.Parse(request.QueryString["projectId"]??"0");var result=await OnUi(application=>ReadBinding(application,projectId));await Write(context.Response,200,result);return;}
      if(request.Url?.AbsolutePath=="/v1/open-request"&&request.HttpMethod=="POST"){using var reader=new StreamReader(request.InputStream,new UTF8Encoding(false,true));var body=await reader.ReadToEndAsync();var open=JsonSerializer.Deserialize<LensNextOpenInRevitRequest>(body,_json)??throw new InvalidOperationException("Open request body is invalid.");_security.ValidateMutation(origin,Bearer(request.Headers["Authorization"]),_session!,open.RequestId,DateTimeOffset.UtcNow);var receipt=await OnUi(application=>new LensNextRevitNavigator(new AutodeskRevit2026Host(application)).Apply(open,_session!.SessionId,DateTimeOffset.UtcNow));await Write(context.Response,200,new{success=true,receipt});return;}
      await Write(context.Response,404,new{success=false,message="Revit bridge route not found."});
    }catch(Exception error){await Write(context.Response,409,new{success=false,message=error.Message});}}

    private object ReadBinding(UIApplication application,int projectId){var path=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"BIMLog","LensNext","revit-2026-binding.json");if(!File.Exists(path))throw new InvalidOperationException("Configure the exact BIMLog/Revit model binding before navigation.");var binding=JsonSerializer.Deserialize<LensNextRevitBindingFile>(File.ReadAllText(path),_json)??throw new InvalidOperationException("Revit model binding is invalid.");if(binding.ProjectId!=projectId)throw new InvalidOperationException("Active Revit binding does not match the authorized BIMLog project.");var host=new AutodeskRevit2026Host(application);LensNextRevitCoordinateResolver.EnsureDocumentMatch(new LensNextRevitModelIdentity{DocumentGuid=binding.DocumentGuid,CentralModelGuid=binding.CentralModelGuid,FileNameNormalized=binding.FileNameNormalized,RevitMajorVersion=2026,CoordinateFrame="revit-internal",NavisworksToRevitTransform=binding.NavisworksToRevitTransform},host.ActiveDocumentGuid,host.ActiveCentralModelGuid,host.RevitMajorVersion);return new{success=true,model=new{documentGuid=binding.DocumentGuid,centralModelGuid=binding.CentralModelGuid,fileNameNormalized=binding.FileNameNormalized,revitMajorVersion=2026,coordinateFrame="revit-internal",navisworksToRevitTransform=binding.NavisworksToRevitTransform},revitElementIds=binding.RevitElementIds};}
    private Task<T> OnUi<T>(Func<UIApplication,T> action){var completion=new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);_handler.Enqueue(application=>{try{completion.SetResult(action(application));}catch(Exception error){completion.SetException(error);}});if(_externalEvent.Raise()!=ExternalEventRequest.Accepted)throw new InvalidOperationException("Revit is busy; retry when the active operation finishes.");return completion.Task.WaitAsync(TimeSpan.FromSeconds(30));}
    private void Cors(HttpListenerResponse response,string origin){if(_security.IsOriginAllowed(origin)){response.Headers["Access-Control-Allow-Origin"]=origin;response.Headers["Vary"]="Origin";response.Headers["Access-Control-Allow-Headers"]="Authorization, Content-Type";response.Headers["Access-Control-Allow-Methods"]="GET, POST, OPTIONS";}}
    private static string Bearer(string? header)=>header?.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)==true?header[7..].Trim():"";
    private async Task Write(HttpListenerResponse response,int status,object value){var bytes=JsonSerializer.SerializeToUtf8Bytes(value,_json);response.StatusCode=status;response.ContentType="application/json; charset=utf-8";response.ContentLength64=bytes.Length;await response.OutputStream.WriteAsync(bytes);response.Close();}
}
