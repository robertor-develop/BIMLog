using System;
using System.Collections.Generic;
using System.Linq;

namespace BIMLogLensNext
{
    public enum LensNextPublishedLayoutPreset
    {
        StatusOnly,
        FloorTradeCompany,
        FloorCompanyTrade,
        CompanyFloorTrade,
        CompanyTradeFloor,
        TradeFloorCompany,
        TradeCompanyFloor,
        Custom
    }

    public enum LensNextPublishedDimension
    {
        Status,
        Floor,
        Trade,
        ResponsibleCompany,
        Priority,
        Phase,
        ReportType
    }

    public sealed class LensNextPublishedViewDescriptor
    {
        public string Status { get; set; }
        public string Floor { get; set; }
        public string Trade { get; set; }
        public string ResponsibleCompany { get; set; }
        public int? Priority { get; set; }
        public string Phase { get; set; }
        public string ReportType { get; set; }
    }

    public sealed class LensNextPublishedLayoutPlan
    {
        public string RootFolder { get; set; }
        public IReadOnlyList<string> Segments { get; set; }
        public string FullPath => string.Join("/", new[] { RootFolder }.Concat(Segments ?? new string[0]));
    }

    public static class LensNextPublishedLayoutPlanner
    {
        public static IReadOnlyList<LensNextPublishedDimension> DimensionsFor(
            LensNextPublishedLayoutPreset preset,
            IReadOnlyList<LensNextPublishedDimension> custom = null)
        {
            switch (preset)
            {
                case LensNextPublishedLayoutPreset.StatusOnly:
                    return new[] { LensNextPublishedDimension.Status };
                case LensNextPublishedLayoutPreset.FloorTradeCompany:
                    return new[] { LensNextPublishedDimension.Floor, LensNextPublishedDimension.Trade, LensNextPublishedDimension.ResponsibleCompany };
                case LensNextPublishedLayoutPreset.FloorCompanyTrade:
                    return new[] { LensNextPublishedDimension.Floor, LensNextPublishedDimension.ResponsibleCompany, LensNextPublishedDimension.Trade };
                case LensNextPublishedLayoutPreset.CompanyFloorTrade:
                    return new[] { LensNextPublishedDimension.ResponsibleCompany, LensNextPublishedDimension.Floor, LensNextPublishedDimension.Trade };
                case LensNextPublishedLayoutPreset.CompanyTradeFloor:
                    return new[] { LensNextPublishedDimension.ResponsibleCompany, LensNextPublishedDimension.Trade, LensNextPublishedDimension.Floor };
                case LensNextPublishedLayoutPreset.TradeFloorCompany:
                    return new[] { LensNextPublishedDimension.Trade, LensNextPublishedDimension.Floor, LensNextPublishedDimension.ResponsibleCompany };
                case LensNextPublishedLayoutPreset.TradeCompanyFloor:
                    return new[] { LensNextPublishedDimension.Trade, LensNextPublishedDimension.ResponsibleCompany, LensNextPublishedDimension.Floor };
                case LensNextPublishedLayoutPreset.Custom:
                    if (custom == null || custom.Count == 0 || custom.Count > 4 || custom.Distinct().Count() != custom.Count)
                        throw new InvalidOperationException("Custom published layout requires 1 to 4 unique dimensions.");
                    return custom.ToArray();
                default:
                    throw new ArgumentOutOfRangeException(nameof(preset));
            }
        }

        public static LensNextPublishedLayoutPlan Plan(
            LensNextPublishedViewDescriptor issue,
            LensNextPublishedLayoutPreset preset,
            IReadOnlyList<LensNextPublishedDimension> custom = null)
        {
            if (issue == null) throw new ArgumentNullException(nameof(issue));
            var segments = DimensionsFor(preset, custom).Select(dimension => Safe(Value(issue, dimension))).ToArray();
            return new LensNextPublishedLayoutPlan
            {
                RootFolder = LensNextConstants.PublishedViewpointFolder,
                Segments = segments
            };
        }

        private static string Value(LensNextPublishedViewDescriptor issue, LensNextPublishedDimension dimension)
        {
            switch (dimension)
            {
                case LensNextPublishedDimension.Status: return Missing(issue.Status, "Unassigned Status");
                case LensNextPublishedDimension.Floor: return Missing(issue.Floor, "Unassigned Floor");
                case LensNextPublishedDimension.Trade: return Missing(issue.Trade, "Unassigned Trade");
                case LensNextPublishedDimension.ResponsibleCompany: return Missing(issue.ResponsibleCompany, "Unassigned Company");
                case LensNextPublishedDimension.Priority: return issue.Priority.HasValue ? "P" + issue.Priority.Value : "No Priority";
                case LensNextPublishedDimension.Phase: return Missing(issue.Phase, "Unassigned Phase");
                case LensNextPublishedDimension.ReportType: return Missing(issue.ReportType, "Unassigned Type");
                default: throw new ArgumentOutOfRangeException(nameof(dimension));
            }
        }

        private static string Missing(string value, string fallback) => string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

        private static string Safe(string value)
        {
            var invalid = new[] { '\\', '/', ':', '*', '?', '"', '<', '>', '|' };
            var result = value;
            foreach (var character in invalid) result = result.Replace(character, '-');
            return result.Trim();
        }
    }
}
