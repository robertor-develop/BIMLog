using System;
using System.Collections.Generic;

namespace BIMLogLensNext
{
    public static class LensNextBridgeCommands
    {
        public const string Ping = "ping";
        public const string Capabilities = "capabilities";
        public const string ProjectContext = "project-context";
        public const string OpenWorkingView = "open-working-view";

        public static IReadOnlyCollection<string> ReadOnlyCommands { get; } = Array.AsReadOnly(new[]
        {
            Ping,
            Capabilities,
            ProjectContext,
            OpenWorkingView
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
        public int Port => LensNextConstants.BridgePort;
        public string Origin => LensNextConstants.BridgeOrigin;
        public bool LoopbackOnly => true;
        public int RequestTimeoutMilliseconds => LensNextConstants.BridgeRequestTimeoutMilliseconds;
        public int MaximumFieldCount => LensNextConstants.BridgeMaximumFieldCount;
        public int MaximumFieldLength => LensNextConstants.BridgeMaximumFieldLength;
        public int MaximumTokenLifetimeMinutes => LensNextConstants.BridgeMaximumTokenLifetimeMinutes;
        public bool ListenerStartedByFoundation => false;
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
        public LensNextCapabilities()
        {
            ProtocolVersion = LensNextConstants.BridgeProtocolVersion;
            Mode = "read_only";
            Commands = LensNextBridgeCommands.ReadOnlyCommands;
            WritesEnabled = false;
            SavedViewpointMutationEnabled = false;
        }

        public int ProtocolVersion { get; }
        public string Mode { get; }
        public IReadOnlyCollection<string> Commands { get; }
        public bool WritesEnabled { get; }
        public bool SavedViewpointMutationEnabled { get; }
    }
}
