using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;

namespace BIMLogLensNext
{
    public sealed class LensNextRevitBridgeSession
    {
        public string SessionId { get; set; }
        public string Token { get; set; }
        public DateTimeOffset IssuedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
    }

    public sealed class LensNextRevitBridgeSecurity
    {
        public const int MaximumSessionMinutes = 30;
        public const int MaximumAcceptedRequests = 10000;
        private readonly HashSet<string> _allowedOrigins;
        private readonly ConcurrentDictionary<string, DateTimeOffset> _acceptedRequests = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.Ordinal);

        public LensNextRevitBridgeSecurity(IEnumerable<string> allowedOrigins)
        {
            _allowedOrigins = new HashSet<string>((allowedOrigins ?? Enumerable.Empty<string>()).Select(NormalizeOrigin), StringComparer.OrdinalIgnoreCase);
            if (_allowedOrigins.Count == 0) throw new InvalidOperationException("Revit bridge requires at least one explicit BIMLog origin.");
            if (_allowedOrigins.Any(origin => !origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && !origin.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase) && !origin.StartsWith("http://127.0.0.1", StringComparison.OrdinalIgnoreCase)))
                throw new InvalidOperationException("Revit bridge origins must use HTTPS except explicit localhost development origins.");
        }

        public bool IsOriginAllowed(string origin) => !string.IsNullOrWhiteSpace(origin) && _allowedOrigins.Contains(NormalizeOrigin(origin));

        public LensNextRevitBridgeSession IssueSession(string origin, DateTimeOffset now)
        {
            if (!IsOriginAllowed(origin)) throw new InvalidOperationException("Revit bridge session bootstrap requires an authorized BIMLog origin.");
            var tokenBytes = new byte[32];
            using (var random = RandomNumberGenerator.Create()) random.GetBytes(tokenBytes);
            return new LensNextRevitBridgeSession {
                SessionId = Guid.NewGuid().ToString("D"),
                Token = Convert.ToBase64String(tokenBytes),
                IssuedAt = now,
                ExpiresAt = now.AddMinutes(MaximumSessionMinutes)
            };
        }

        public void ValidateMutation(string origin, string bearerToken, LensNextRevitBridgeSession session, string requestId, DateTimeOffset now)
        {
            if (!IsOriginAllowed(origin)) throw new InvalidOperationException("Revit bridge origin is not authorized.");
            if (session == null || now < session.IssuedAt || now >= session.ExpiresAt || session.ExpiresAt > session.IssuedAt.AddMinutes(MaximumSessionMinutes))
                throw new InvalidOperationException("Revit bridge session is expired or invalid.");
            if (string.IsNullOrEmpty(bearerToken) || !FixedTimeEquals(bearerToken, session.Token))
                throw new InvalidOperationException("Revit bridge bearer token is invalid.");
            if (!Guid.TryParse(requestId, out _)) throw new InvalidOperationException("Revit bridge mutation requires a UUID request identity.");
            Prune(now);
            if (_acceptedRequests.Count >= MaximumAcceptedRequests) throw new InvalidOperationException("Revit bridge replay registry is at capacity.");
            if (!_acceptedRequests.TryAdd(requestId, session.ExpiresAt)) throw new InvalidOperationException("Revit bridge rejected a replayed request identity.");
        }

        private void Prune(DateTimeOffset now)
        {
            foreach (var entry in _acceptedRequests.Where(entry => entry.Value <= now).ToArray())
                _acceptedRequests.TryRemove(entry.Key, out _);
        }

        private static string NormalizeOrigin(string origin) => (origin ?? string.Empty).Trim().TrimEnd('/');
        private static bool FixedTimeEquals(string left, string right)
        {
            if (left == null || right == null) return false;
            var a = System.Text.Encoding.UTF8.GetBytes(left);
            var b = System.Text.Encoding.UTF8.GetBytes(right);
            if (a.Length != b.Length) return false;
            var difference = 0;
            for (var index = 0; index < a.Length; index++) difference |= a[index] ^ b[index];
            return difference == 0;
        }
    }
}
