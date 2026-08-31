using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public static class LensNextBridgeCommands
    {
        public const string Ping = "ping";
        public const string Capabilities = "capabilities";
        public const string ProjectContext = "project-context";
        public const string LocalInventory = "local-inventory";
        public const string BindProject = "bind-project";
        public const string OpenWorkingView = "open-working-view";
        public const string CaptureVisualState = "capture-visual-state";
        public const string CaptureLocalViewpoint = "capture-local-viewpoint";
        public const string CaptureNewViewpoint = "capture-new-viewpoint";
        public const string ApplyWorkingView = "apply-working-view";
        public const string PublishWorkingView = "publish-working-view";
        public const string MaterializeMyView = "materialize-my-view";

        public static IReadOnlyCollection<string> ReadOnlyCommands { get; } = Array.AsReadOnly(new[]
        {
            Ping,
            Capabilities,
            ProjectContext,
            LocalInventory,
            BindProject,
            OpenWorkingView,
            CaptureVisualState,
            CaptureLocalViewpoint,
            CaptureNewViewpoint,
            ApplyWorkingView
        });

        public static IReadOnlyCollection<string> PilotWriteCommands { get; } =
            Array.AsReadOnly(new[]
            {
                PublishWorkingView,
                MaterializeMyView
            });
    }

    public sealed class LensNextBridgeRequest
    {
        public int ProtocolVersion { get; set; }
        public string RequestId { get; set; }
        public string IdempotencyKey { get; set; }
        public string SessionToken { get; set; }
        public string Origin { get; set; }
        public string Command { get; set; }
        public IReadOnlyDictionary<string, string> Fields { get; set; }
    }

    public sealed class LensNextBridgeBindingContract
    {
        public string Scheme => "http";
        public string Host => LensNextConstants.BridgeHost;
        public int Port => LensNextConstants.BridgeMinimumPort;
        public string Origin => "dynamic-process-loopback";
        public bool LoopbackOnly => true;
        public int RequestTimeoutMilliseconds => LensNextConstants.BridgeRequestTimeoutMilliseconds;
        public int MaximumFieldCount => LensNextConstants.BridgeMaximumFieldCount;
        public int MaximumFieldLength => LensNextConstants.BridgeMaximumFieldLength;
        public int MaximumTokenLifetimeMinutes => LensNextConstants.BridgeMaximumTokenLifetimeMinutes;
        public bool ListenerStartedByFoundation => true;
    }

    public sealed class LensNextBridgeResponse
    {
        private LensNextBridgeResponse(bool success, string code, string message, object payload)
        {
            Success = success;
            Code = code;
            Message = message;
            Payload = payload;
        }

        public bool Success { get; }
        public string Code { get; }
        public string Message { get; }
        public object Payload { get; }

        public static LensNextBridgeResponse Ok(string code, object payload = null)
        {
            return new LensNextBridgeResponse(true, code, null, payload);
        }

        public static LensNextBridgeResponse Blocked(string code, string message)
        {
            return new LensNextBridgeResponse(false, code, message, null);
        }
    }

    public sealed class LensNextPingPayload
    {
        public int ProtocolVersion => LensNextConstants.BridgeProtocolVersion;
    }

    public sealed class LensNextWireIdentity
    {
        public int ProjectId { get; set; }
        public int ServerId { get; set; }
        public string ViewpointId { get; set; }
        public string LifecycleStatus { get; set; }
        public int RevisionNumber { get; set; }
    }

    public sealed class LensNextOpenWorkingViewPayload
    {
        public bool Opened => true;
        public string RequestId { get; set; }
        public LensNextWireIdentity Identity { get; set; }
    }

    public sealed class LensNextCapabilities
    {
        public LensNextCapabilities(bool viewpointPublishingEnabled = false)
        {
            ProtocolVersion = LensNextConstants.BridgeProtocolVersion;
            Mode = viewpointPublishingEnabled ? "m7_local_pilot" : "read_only";

            var commands = new List<string>(
                LensNextBridgeCommands.ReadOnlyCommands
            );

            if (viewpointPublishingEnabled)
            {
                commands.Add(LensNextBridgeCommands.PublishWorkingView);
                commands.Add(LensNextBridgeCommands.MaterializeMyView);
            }

            Commands = commands.AsReadOnly();
            WritesEnabled = viewpointPublishingEnabled;
            SavedViewpointMutationEnabled = viewpointPublishingEnabled;
            ViewpointPublishingEnabled = viewpointPublishingEnabled;
            ProductionWritesEnabled = false;
            VisualCaptureEnabled = true;
            WorkingViewReconstructionEnabled = true;
            PlatformVisualWriteEnabled = false;
        }

        public int ProtocolVersion { get; }
        public string Mode { get; }
        public IReadOnlyCollection<string> Commands { get; }
        public bool WritesEnabled { get; }
        public bool SavedViewpointMutationEnabled { get; }
        public bool ViewpointPublishingEnabled { get; }
        public bool ProductionWritesEnabled { get; }
        public bool VisualCaptureEnabled { get; }
        public bool WorkingViewReconstructionEnabled { get; }
        public bool PlatformVisualWriteEnabled { get; }
    }
}
