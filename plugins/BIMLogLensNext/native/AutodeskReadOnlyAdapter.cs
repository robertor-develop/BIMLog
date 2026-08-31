using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using Autodesk.Navisworks.Api;
using BIMLogLensNext;

namespace BIMLogLensNext.Native
{
    public sealed class AutodeskReadOnlyAdapterContract
    {
        private string _projectId;
        private readonly string _modelFingerprint;

        public AutodeskReadOnlyAdapterContract(string projectId, string modelFingerprint)
        {
            int parsedProjectId;
            if (!string.IsNullOrWhiteSpace(projectId) && (!int.TryParse(projectId, out parsedProjectId) || parsedProjectId <= 0))
            {
                throw new ArgumentException("A positive BIMLog project ID is required.", nameof(projectId));
            }
            if (!IsSha256(modelFingerprint))
            {
                throw new ArgumentException("An exact SHA-256 model fingerprint is required.", nameof(modelFingerprint));
            }

            _projectId = projectId;
            _modelFingerprint = modelFingerprint;
        }

        public string ProjectId => _projectId;
        public string ModelFingerprint => _modelFingerprint;

        public void BindProject(string projectId)
        {
            int parsed;
            if (!int.TryParse(projectId, out parsed) || parsed <= 0) throw new ArgumentException("A positive BIMLog project ID is required.", nameof(projectId));
            _projectId = projectId;
        }

        public bool MatchesContext(ImmutableWorkingViewIdentity identity)
        {
            return identity != null &&
                string.Equals(identity.ProjectId, _projectId, StringComparison.Ordinal) &&
                string.Equals(identity.ModelFingerprint, _modelFingerprint, StringComparison.Ordinal);
        }

        public bool Matches(ImmutableWorkingViewIdentity identity)
        {
            return MatchesContext(identity) && TryParseNonEmptyGuid(identity.NavisworksGuid, out _);
        }

        public static bool MatchesBimlogMetadata(
            string commentBody,
            string projectId,
            string serverId)
        {
            return MatchesBimlogMetadata(new[] { commentBody }, projectId, serverId);
        }

        public static bool MatchesBimlogMetadata(
            IEnumerable<string> commentBodies,
            string projectId,
            string serverId)
        {
            if (commentBodies == null ||
                string.IsNullOrWhiteSpace(projectId) ||
                string.IsNullOrWhiteSpace(serverId))
                return false;

            var managed = commentBodies.Where(IsBimlogManagedComment).ToArray();
            if (managed.Length == 0) return false;

            return string.Equals(LatestInteger(managed, "serverId"), serverId, StringComparison.Ordinal) &&
                (string.Equals(LatestInteger(managed, "sourceProjectId"), projectId, StringComparison.Ordinal) ||
                 string.Equals(LatestInteger(managed, "projectId"), projectId, StringComparison.Ordinal));
        }

        public static bool IsBimlogManagedComment(string commentBody)
        {
            return !string.IsNullOrWhiteSpace(commentBody) && Regex.IsMatch(
                commentBody,
                "\\\"source\\\"\\s*:\\s*\\\"BIMLogLens\\\"",
                RegexOptions.CultureInvariant);
        }

        public static bool MatchesBimlogPhysicalMetadata(string commentBody, string projectId, string physicalId)
        {
            return MatchesBimlogPhysicalMetadata(new[] { commentBody }, projectId, physicalId);
        }

        public static bool MatchesBimlogPhysicalMetadata(
            IEnumerable<string> commentBodies,
            string projectId,
            string physicalId)
        {
            if (commentBodies == null || string.IsNullOrWhiteSpace(projectId) || string.IsNullOrWhiteSpace(physicalId)) return false;
            var managed = commentBodies.Where(IsBimlogManagedComment).ToArray();
            if (managed.Length == 0 ||
                !string.Equals(LatestString(managed, "bimlogPhysicalId"), physicalId, StringComparison.OrdinalIgnoreCase)) return false;
            return string.Equals(LatestInteger(managed, "sourceProjectId"), projectId, StringComparison.Ordinal) ||
                string.Equals(LatestInteger(managed, "projectId"), projectId, StringComparison.Ordinal);
        }

        public static string DisplayCode(string displayName)
        {
            var parts = (displayName ?? string.Empty).Split(
                new[] { " | " },
                StringSplitOptions.None);
            return parts.Length == 0 ? string.Empty : parts[0].Trim();
        }

        public static string LegacyPhysicalCode(string viewpointId)
        {
            var parts = (viewpointId ?? string.Empty).Split(
                new[] { " | " },
                StringSplitOptions.None);
            return parts.Length > 1 ? parts[1].Trim() : string.Empty;
        }

        public static bool MatchesLegacyPhysicalCode(string displayName, string legacyPhysicalCode)
        {
            if (string.IsNullOrWhiteSpace(displayName) ||
                string.IsNullOrWhiteSpace(legacyPhysicalCode)) return false;

            return Regex.IsMatch(
                displayName,
                "(^|[^A-Za-z0-9])" + Regex.Escape(legacyPhysicalCode.Trim()) + "([^A-Za-z0-9]|$)",
                RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
        }

        public static string LegacyNavisworksSourceCode(string legacyPhysicalCode)
        {
            var match = Regex.Match(
                legacyPhysicalCode ?? string.Empty,
                "^([A-Za-z])[A-Za-z]*-([0-9]+)$",
                RegexOptions.CultureInvariant);
            return match.Success
                ? match.Groups[1].Value.ToUpperInvariant() + "." + match.Groups[2].Value
                : string.Empty;
        }

        public static string LegacyTitleFragment(string viewpointId)
        {
            var parts = (viewpointId ?? string.Empty).Split(
                new[] { " | " },
                StringSplitOptions.None);
            return parts.Length > 5 ? parts[5].Trim() : string.Empty;
        }

        public static bool MatchesLegacyTitleFragment(string displayName, string titleFragment)
        {
            if (string.IsNullOrWhiteSpace(displayName) ||
                string.IsNullOrWhiteSpace(titleFragment) ||
                titleFragment.Trim().Length < 12) return false;

            return displayName.Trim().StartsWith(
                titleFragment.Trim(),
                StringComparison.OrdinalIgnoreCase);
        }

        public static bool MatchesLegacyInnerTitle(string displayName, string titleFragment)
        {
            if (string.IsNullOrWhiteSpace(displayName) ||
                string.IsNullOrWhiteSpace(titleFragment)) return false;

            var match = Regex.Match(
                titleFragment.Trim(),
                "---\\s*(.+?)\\s*---",
                RegexOptions.CultureInvariant);
            if (!match.Success || match.Groups[1].Value.Trim().Length < 6) return false;

            var expected = NormalizeLegacyTitle(match.Groups[1].Value);
            var actual = NormalizeLegacyTitle(displayName);
            if (string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase)) return true;

            var separator = actual.LastIndexOf('|');
            return separator >= 0 && string.Equals(
                actual.Substring(separator + 1).Trim(),
                expected,
                StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeLegacyTitle(string value)
        {
            return Regex.Replace((value ?? string.Empty).Trim(), "\\s+", " ");
        }

        private static bool HasExactInteger(string body, string key, string expected)
        {
            var match = Regex.Match(
                body,
                "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*([1-9][0-9]*)",
                RegexOptions.CultureInvariant);
            return match.Success && string.Equals(match.Groups[1].Value, expected, StringComparison.Ordinal);
        }

        private static bool HasExactString(string body, string key, string expected)
        {
            var match = Regex.Match(
                body,
                "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"",
                RegexOptions.CultureInvariant);
            return match.Success && string.Equals(match.Groups[1].Value, expected, StringComparison.OrdinalIgnoreCase);
        }

        private static string LatestInteger(IEnumerable<string> bodies, string key)
        {
            string latest = null;
            foreach (var body in bodies)
            {
                var match = Regex.Match(
                    body ?? string.Empty,
                    "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*([1-9][0-9]*)",
                    RegexOptions.CultureInvariant);
                if (match.Success) latest = match.Groups[1].Value;
            }
            return latest;
        }

        private static string LatestString(IEnumerable<string> bodies, string key)
        {
            string latest = null;
            foreach (var body in bodies)
            {
                var match = Regex.Match(
                    body ?? string.Empty,
                    "\\\"" + Regex.Escape(key) + "\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"",
                    RegexOptions.CultureInvariant);
                if (match.Success) latest = match.Groups[1].Value;
            }
            return latest;
        }

        public static string LatestManagedInteger(IEnumerable<string> commentBodies, string key)
        {
            return LatestInteger((commentBodies ?? Array.Empty<string>()).Where(IsBimlogManagedComment), key);
        }

        public static string LatestManagedString(IEnumerable<string> commentBodies, string key)
        {
            return LatestString((commentBodies ?? Array.Empty<string>()).Where(IsBimlogManagedComment), key);
        }

        public static string ResolveUniqueManagedProjectId(IEnumerable<IEnumerable<string>> commentSets)
        {
            var ids = (commentSets ?? Array.Empty<IEnumerable<string>>()).Select(comments =>
            {
                var bodies = (comments ?? Array.Empty<string>()).ToArray();
                return LatestManagedInteger(bodies, "sourceProjectId") ?? LatestManagedInteger(bodies, "projectId");
            }).Where(value => !string.IsNullOrWhiteSpace(value)).Distinct(StringComparer.Ordinal).ToArray();
            if (ids.Length > 1) throw new InvalidOperationException("Multiple BIMLog project identities exist in the active Navisworks model; automatic binding was refused.");
            return ids.Length == 1 ? ids[0] : null;
        }

        public static bool TryParseNonEmptyGuid(string value, out Guid guid)
        {
            return Guid.TryParse(value, out guid) && guid != Guid.Empty;
        }

        private static bool IsSha256(string value)
        {
            return value != null && value.Length == 64 && value.All(character =>
                (character >= '0' && character <= '9') ||
                (character >= 'a' && character <= 'f') ||
                (character >= 'A' && character <= 'F'));
        }
    }

    public sealed class AutodeskNavisworksUiThreadDispatcher : INavisworksUiThreadDispatcher
    {
        private readonly int _ownerThreadId;

        public AutodeskNavisworksUiThreadDispatcher()
        {
            _ownerThreadId = Thread.CurrentThread.ManagedThreadId;
        }

        public T Invoke<T>(Func<T> action)
        {
            if (action == null) throw new ArgumentNullException(nameof(action));
            if (Thread.CurrentThread.ManagedThreadId != _ownerThreadId)
            {
                throw new InvalidOperationException("Navisworks read/navigation calls require the owning UI thread.");
            }
            return action();
        }
    }

    public sealed partial class AutodeskLensNextReadOnlyAdapter : ILensNextReadOnlyNavisworksAdapter, ILensNextVisualNavisworksAdapter
    {
        private readonly Document _document;
        private readonly string _documentFileName;
        private readonly AutodeskReadOnlyAdapterContract _contract;
        private readonly Action<int> _onProjectBound;
        private string _bindingSource;

        public AutodeskLensNextReadOnlyAdapter(Document document, string projectId, string modelFingerprint, Action<int> onProjectBound = null)
        {
            _document = document ?? throw new ArgumentNullException(nameof(document));
            if (_document.IsDisposed || _document.IsClear || string.IsNullOrWhiteSpace(_document.FileName))
            {
                throw new InvalidOperationException("An open named Navisworks document is required.");
            }
            _documentFileName = Path.GetFullPath(_document.FileName);
            _contract = new AutodeskReadOnlyAdapterContract(projectId, modelFingerprint);
            _onProjectBound = onProjectBound;
            _bindingSource = string.IsNullOrWhiteSpace(projectId) ? "unbound" : "navisworks_bimlog_metadata";
        }

        public LensNextProjectContext ReadProjectContext()
        {
            EnsureSameDocument();
            return new LensNextProjectContext
            {
                ProjectId = _contract.ProjectId,
                ModelFingerprint = _contract.ModelFingerprint,
                DisplayName = string.IsNullOrWhiteSpace(_document.Title)
                    ? Path.GetFileName(_documentFileName)
                    : _document.Title,
                BindingSource = _bindingSource,
                ModelBindingKey = LensNextModelFingerprint.ComputeBindingKey(_documentFileName),
                ManagedViewpointCount = ReadLocalInventory().Viewpoints.Count
            };
        }

        public LensNextLocalInventory ReadLocalInventory()
        {
            EnsureSameDocument();
            var located = new List<Tuple<SavedViewpoint, string>>();
            CollectLocatedViewpoints(_document.SavedViewpoints.RootItem.Children, string.Empty, located);
            var managed = located.Where(item => item.Item1.Comments.Cast<Comment>().Any(comment =>
                AutodeskReadOnlyAdapterContract.IsBimlogManagedComment(comment.Body)));
            var rows = managed.Select(item =>
            {
                var bodies = item.Item1.Comments.Cast<Comment>().Select(comment => comment.Body).ToArray();
                var projectId = AutodeskReadOnlyAdapterContract.LatestManagedInteger(bodies, "sourceProjectId") ??
                    AutodeskReadOnlyAdapterContract.LatestManagedInteger(bodies, "projectId");
                var serverId = AutodeskReadOnlyAdapterContract.LatestManagedInteger(bodies, "serverId");
                var viewpointId = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "viewpointId") ?? item.Item1.DisplayName;
                var displayId = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "displayId") ??
                    AutodeskReadOnlyAdapterContract.DisplayCode(item.Item1.DisplayName);
                var physicalId = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "bimlogPhysicalId");
                return new LensNextLocalViewpoint
                {
                    ProjectId = projectId,
                    ServerId = serverId,
                    ViewpointId = viewpointId,
                    DisplayId = displayId,
                    BimlogPhysicalId = physicalId,
                    NavisworksGuid = item.Item1.Guid.ToString("D"),
                    DisplayName = item.Item1.DisplayName,
                    FolderPath = item.Item2,
                    Note = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "note"),
                    Trade = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "trade"),
                    ResponsibleCompany = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "responsibleCompany"),
                    ReportType = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "reportType"),
                    Floor = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "floor"),
                    Priority = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "priority"),
                    OpenItems = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "openItems"),
                    Status = AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "workflowStatus") ?? AutodeskReadOnlyAdapterContract.LatestManagedString(bodies, "status"),
                    ExactManagedIdentity = !string.IsNullOrWhiteSpace(projectId) &&
                        (!string.IsNullOrWhiteSpace(serverId) || !string.IsNullOrWhiteSpace(physicalId) || !string.IsNullOrWhiteSpace(displayId)),
                    LensNextPublished = bodies.Any(body => (body ?? "").Contains(LensNextConstants.PublishedViewpointMarker))
                };
            }).Where(row => string.IsNullOrWhiteSpace(_contract.ProjectId) || string.Equals(row.ProjectId, _contract.ProjectId, StringComparison.Ordinal)).ToArray();
            return new LensNextLocalInventory
            {
                ProjectId = _contract.ProjectId,
                ModelFingerprint = _contract.ModelFingerprint,
                ModelBindingKey = LensNextModelFingerprint.ComputeBindingKey(_documentFileName),
                Viewpoints = Array.AsReadOnly(rows)
            };
        }

        public LensNextProjectContext BindProject(string projectId, string bindingSource)
        {
            EnsureSameDocument();
            if (!string.Equals(bindingSource, "bimlog_model_registry", StringComparison.Ordinal))
                throw new InvalidOperationException("Only an authoritative BIMLog model-registry binding is accepted.");
            var detected = DetectManagedProjectId(_document);
            if (!string.IsNullOrWhiteSpace(detected) && !string.Equals(detected, projectId, StringComparison.Ordinal))
                throw new InvalidOperationException("The BIMLog registry binding conflicts with managed viewpoint metadata in this model.");
            _contract.BindProject(projectId);
            _bindingSource = bindingSource;
            _onProjectBound?.Invoke(int.Parse(projectId));
            return ReadProjectContext();
        }

        public static string DetectManagedProjectId(Document document)
        {
            if (document == null || document.IsDisposed || document.IsClear) return null;
            var viewpoints = new List<SavedViewpoint>();
            CollectViewpoints(document.SavedViewpoints.RootItem.Children, viewpoints);
            return AutodeskReadOnlyAdapterContract.ResolveUniqueManagedProjectId(
                viewpoints.Select(view => view.Comments.Cast<Comment>().Select(comment => comment.Body)));
        }

        public IReadOnlyCollection<WorkingViewCandidate> FindExistingWorkingViews(
            ImmutableWorkingViewIdentity identity)
        {
            EnsureSameDocument();
            if (!_contract.MatchesContext(identity)) return Array.Empty<WorkingViewCandidate>();

            // Original Lens owns the historical physical Saved Viewpoints. Lens Next
            // may use one only when it is independently correlated to the selected
            // BIMLog row; a stale GUID by itself is never sufficient.
            var all = new List<SavedViewpoint>();
            CollectViewpoints(_document.SavedViewpoints.RootItem.Children, all);
            LensNextNativeLog.Info(
                "Working-view resolution. RequestedViewpointId=" + (identity.ViewpointId ?? "<null>") +
                " RequestedNavisworksGuid=" + (identity.NavisworksGuid ?? "<null>") +
                " SavedViewpointCount=" + all.Count +
                " SavedViewpoints=" + string.Join(";", all.Select(view =>
                    view.Guid.ToString("D") + "|" + (view.DisplayName ?? "<null>") + "|comments=" + view.Comments.Count)));
            var managed = all.Where(view => view.Comments.Cast<Comment>().Any(comment =>
                AutodeskReadOnlyAdapterContract.IsBimlogManagedComment(comment.Body))).ToArray();
            var metadataMatches = managed.Where(view =>
                AutodeskReadOnlyAdapterContract.MatchesBimlogMetadata(
                    view.Comments.Cast<Comment>().Select(comment => comment.Body),
                    identity.ProjectId,
                    identity.ServerId)).ToArray();
            var physicalMatches = managed.Where(view =>
                AutodeskReadOnlyAdapterContract.MatchesBimlogPhysicalMetadata(
                    view.Comments.Cast<Comment>().Select(comment => comment.Body),
                    identity.ProjectId,
                    identity.BimlogPhysicalId)).ToArray();
            // Original Lens persisted platform viewpointId from SavedViewpoint.DisplayName.
            // For rows without a native GUID, the only permitted legacy bridge is
            // full ordinal equality. Do not restrict this lookup to comment-managed
            // viewpoints: historical Original Lens rows predate those comments.
            var exactNameMatches = all.Where(view =>
                    !string.IsNullOrWhiteSpace(identity.ViewpointId) &&
                    string.Equals(view.DisplayName, identity.ViewpointId, StringComparison.Ordinal)).ToArray();
            // Never infer a visual source from a trade code or a title fragment.
            // Those fields are not immutable identities and can point at a different
            // camera/model state. Legacy recovery is permitted only through exact
            // BIMLog metadata or the exact BIMLog display code.
            var correlated = metadataMatches.Length > 0 ? metadataMatches :
                physicalMatches.Length > 0 ? physicalMatches : exactNameMatches;

            Guid nativeGuid;
            if (AutodeskReadOnlyAdapterContract.TryParseNonEmptyGuid(identity.NavisworksGuid, out nativeGuid))
            {
                var exactGuid = _document.SavedViewpoints.ResolveGuid(nativeGuid) as SavedViewpoint;
                // The original Lens persisted the native GUID to BIMLog before it
                // began stamping Lens Next-managed comments into the NWD.  An exact
                // GUID resolved by this active document is already the immutable
                // physical identity; requiring a newer metadata comment here made
                // every valid legacy viewpoint look missing.
                if (exactGuid != null && exactGuid.Guid == nativeGuid)
                    return Candidate(identity, exactGuid, false);
            }

            return Array.AsReadOnly(correlated.SelectMany(view => Candidate(identity, view, true)).ToArray());
        }

        private static IReadOnlyCollection<WorkingViewCandidate> Candidate(
            ImmutableWorkingViewIdentity identity,
            SavedViewpoint savedViewpoint,
            bool allowsStaleNavisworksGuidReplacement)
        {
            return Array.AsReadOnly(new[]
            {
                new WorkingViewCandidate
                {
                    ProjectId = identity.ProjectId,
                    ServerId = identity.ServerId,
                    ViewpointId = identity.ViewpointId,
                    LifecycleStatus = identity.LifecycleStatus,
                    RevisionNumber = identity.RevisionNumber,
                    ModelFingerprint = identity.ModelFingerprint,
                    BimlogPhysicalId = identity.BimlogPhysicalId,
                    NavisworksGuid = savedViewpoint.Guid.ToString("D"),
                    AllowsStaleNavisworksGuidReplacement = allowsStaleNavisworksGuidReplacement,
                    NativeHandle = savedViewpoint
                }
            });
        }

        private static void CollectViewpoints(
            SavedItemCollection items,
            ICollection<SavedViewpoint> output)
        {
            foreach (var item in items)
            {
                var viewpoint = item as SavedViewpoint;
                if (viewpoint != null)
                {
                    output.Add(viewpoint);
                    continue;
                }
                var group = item as GroupItem;
                if (group != null)
                    CollectViewpoints(group.Children, output);
            }
        }

        private static void CollectLocatedViewpoints(
            SavedItemCollection items,
            string parentPath,
            ICollection<Tuple<SavedViewpoint, string>> output)
        {
            foreach (var item in items)
            {
                var viewpoint = item as SavedViewpoint;
                if (viewpoint != null)
                {
                    output.Add(Tuple.Create(viewpoint, parentPath));
                    continue;
                }
                var group = item as GroupItem;
                if (group != null)
                {
                    var path = string.IsNullOrWhiteSpace(parentPath)
                        ? group.DisplayName
                        : parentPath + " / " + group.DisplayName;
                    CollectLocatedViewpoints(group.Children, path, output);
                }
            }
        }

        public bool OpenExistingWorkingView(WorkingViewCandidate candidate)
        {
            EnsureSameDocument();
            if (candidate == null || candidate.NativeHandle == null) return false;
            if (!string.Equals(candidate.ProjectId, _contract.ProjectId, StringComparison.Ordinal) ||
                !string.Equals(candidate.ModelFingerprint, _contract.ModelFingerprint, StringComparison.Ordinal))
            {
                return false;
            }

            var savedViewpoint = candidate.NativeHandle as SavedViewpoint;
            Guid requestedGuid;
            if (savedViewpoint == null ||
                !AutodeskReadOnlyAdapterContract.TryParseNonEmptyGuid(candidate.NavisworksGuid, out requestedGuid) ||
                savedViewpoint.Guid != requestedGuid)
            {
                return false;
            }

            var currentObject = _document.SavedViewpoints.ResolveGuid(requestedGuid) as SavedViewpoint;
            if (currentObject == null || currentObject.Guid != requestedGuid) return false;
            _document.SavedViewpoints.CurrentSavedViewpoint = currentObject;
            return true;
        }

        public LensNextLocalViewpoint OpenExactManagedLocalViewpoint(string projectId, string navisworksGuid)
        {
            EnsureSameDocument();
            if (!string.Equals(projectId, _contract.ProjectId, StringComparison.Ordinal)) return null;
            Guid requestedGuid;
            if (!AutodeskReadOnlyAdapterContract.TryParseNonEmptyGuid(navisworksGuid, out requestedGuid)) return null;
            var inventory = ReadLocalInventory();
            var matches = (inventory.Viewpoints ?? Array.Empty<LensNextLocalViewpoint>())
                .Where(value => value != null && value.ExactManagedIdentity && string.IsNullOrWhiteSpace(value.ServerId) &&
                    string.Equals(value.ProjectId, projectId, StringComparison.Ordinal) &&
                    string.Equals(value.NavisworksGuid, requestedGuid.ToString("D"), StringComparison.OrdinalIgnoreCase)).ToArray();
            if (matches.Length != 1) return null;
            var exact = _document.SavedViewpoints.ResolveGuid(requestedGuid) as SavedViewpoint;
            if (exact == null || exact.Guid != requestedGuid) return null;
            _document.SavedViewpoints.CurrentSavedViewpoint = exact;
            return matches[0];
        }

        private void EnsureSameDocument()
        {
            if (_document.IsDisposed || _document.IsClear || string.IsNullOrWhiteSpace(_document.FileName) ||
                !string.Equals(Path.GetFullPath(_document.FileName), _documentFileName, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("The active Navisworks document changed; recreate the bridge session.");
            }
        }
    }
}
