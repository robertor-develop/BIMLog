using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Script.Serialization;
using Autodesk.Navisworks.Api;

namespace BIMLogLensNext.Native
{
    public sealed partial class AutodeskLensNextReadOnlyAdapter : ILensNextLayoutNavisworksAdapter
    {
        private const string MyViewRoot = "BIMLog Lens Next - My View";

        public LensNextLayoutResult MaterializeMyView(LensNextLayoutRequest request)
        {
            EnsureSameDocument();
            if (request == null || string.IsNullOrWhiteSpace(request.ConfirmationReason)) throw new InvalidOperationException("Explicit My View layout confirmation is required.");
            if (!string.Equals(request.ProjectId, _contract.ProjectId, StringComparison.Ordinal) || !string.Equals(request.ModelFingerprint, _contract.ModelFingerprint, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("My View layout does not match the active BIMLog project/model context.");
            var items = new JavaScriptSerializer().Deserialize<List<LensNextLayoutItem>>(request.LayoutJson) ?? new List<LensNextLayoutItem>();
            if (items.Count == 0 || items.Count > 5000) throw new InvalidOperationException("My View layout must contain between 1 and 5000 exact items.");
            if (items.Select(item => item.NavisworksGuid).Distinct(StringComparer.OrdinalIgnoreCase).Count() != items.Count) throw new InvalidOperationException("My View layout contains duplicate Navisworks identities.");
            var result = new LensNextLayoutResult { Requested = items.Count };
            foreach (var item in items)
            {
                Guid guid;
                if (!Guid.TryParse(item.NavisworksGuid, out guid) || guid == Guid.Empty) throw new InvalidOperationException("My View layout contains an invalid Navisworks GUID.");
                var viewpoint = _document.SavedViewpoints.ResolveGuid(guid) as SavedViewpoint;
                if (viewpoint == null || !viewpoint.Comments.Cast<Comment>().Any(comment => (comment.Body ?? "").Contains(LensNextConstants.PublishedViewpointMarker))) throw new InvalidOperationException("Only an exact Lens Next-published Saved Viewpoint may be organized.");
                var located = Locate(viewpoint.Guid, _document.SavedViewpoints.RootItem, string.Empty);
                if (located == null) throw new InvalidOperationException("The exact Saved Viewpoint parent could not be resolved.");
                var target = EnsurePath(item.FolderPath);
                if (ReferenceEquals(located.Item1, target) || string.Equals(located.Item2, PathOf(target), StringComparison.OrdinalIgnoreCase)) { result.AlreadyPlaced++; continue; }
                var sourceIndex = -1;
                for (var index = 0; index < located.Item1.Children.Count; index++) { var candidate = located.Item1.Children[index] as SavedViewpoint; if (candidate != null && candidate.Guid == guid) { if (sourceIndex >= 0) throw new InvalidOperationException("Ambiguous Saved Viewpoint source index."); sourceIndex = index; } }
                if (sourceIndex < 0) throw new InvalidOperationException("Saved Viewpoint source index was not found.");
                var destinationIndex = target.Children.Count == 0 ? 0 : target.Children.Count - 1;
                _document.SavedViewpoints.Move(located.Item1, sourceIndex, target, destinationIndex);
                var moved = _document.SavedViewpoints.ResolveGuid(guid) as SavedViewpoint;
                var verified = moved == null ? null : Locate(guid, _document.SavedViewpoints.RootItem, string.Empty);
                if (verified == null || !string.Equals(verified.Item2, PathOf(target), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Saved Viewpoint move could not be verified.");
                result.Moved++;
            }
            return result;
        }

        private Tuple<GroupItem, string> Locate(Guid guid, GroupItem parent, string parentPath)
        {
            foreach (SavedItem child in parent.Children)
            {
                var view = child as SavedViewpoint;
                if (view != null && view.Guid == guid) return Tuple.Create(parent, parentPath);
                var group = child as GroupItem;
                if (group != null) { var path = string.IsNullOrWhiteSpace(parentPath) ? group.DisplayName : parentPath + " / " + group.DisplayName; var found = Locate(guid, group, path); if (found != null) return found; }
            }
            return null;
        }

        private GroupItem EnsurePath(string relativePath)
        {
            var root = _document.SavedViewpoints.RootItem.Children.OfType<GroupItem>().SingleOrDefault(group => string.Equals(group.DisplayName, MyViewRoot, StringComparison.Ordinal));
            if (root == null) { var created = _document.SavedViewpoints.RootItem.CreateCopyWithoutChildren(); created.DisplayName = MyViewRoot; _document.SavedViewpoints.AddCopy(created); root = _document.SavedViewpoints.RootItem.Children.OfType<GroupItem>().Single(group => string.Equals(group.DisplayName, MyViewRoot, StringComparison.Ordinal)); }
            var current = root;
            foreach (var raw in (relativePath ?? "").Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var name = Sanitize(raw);
                var next = current.Children.OfType<GroupItem>().SingleOrDefault(group => string.Equals(group.DisplayName, name, StringComparison.Ordinal));
                if (next == null) { var created = current.CreateCopyWithoutChildren(); created.DisplayName = name; _document.SavedViewpoints.AddCopy(current, created); next = current.Children.OfType<GroupItem>().Single(group => string.Equals(group.DisplayName, name, StringComparison.Ordinal)); }
                current = next;
            }
            return current;
        }

        private static string Sanitize(string value) { var clean = new string((value ?? "").Trim().Where(character => character >= 32 && character != '/' && character != '\\').ToArray()); if (string.IsNullOrWhiteSpace(clean)) clean = "Unassigned"; return clean.Length > 96 ? clean.Substring(0, 96) : clean; }
        private static string PathOf(GroupItem group) { var parts = new List<string>(); SavedItem current = group; while (current is GroupItem) { parts.Add(current.DisplayName); current = current.Parent; } parts.Reverse(); return string.Join(" / ", parts); }
    }
}
