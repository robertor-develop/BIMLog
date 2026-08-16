using System;
using System.Drawing;
using System.Windows.Forms;
using Autodesk.Navisworks.Api.Plugins;
using DrawingColor = System.Drawing.Color;
using NavisworksApplication = Autodesk.Navisworks.Api.Application;

namespace BIMLogLensNext.Native
{
    [Plugin("BIMLogLensNext", "IgniteSmart", DisplayName = "BIMLog Lens Next", ToolTip = "Read-only BIMLog Lens Next panel")]
    public sealed class BIMLogLensNextDockPanePlugin : DockPanePlugin
    {
        public override Control CreateControlPane()
        {
            var panel = new UserControl { BackColor = DrawingColor.White, MinimumSize = new Size(320, 180) };
            var title = new Label { AutoSize = true, Font = new Font("Segoe UI", 12F, FontStyle.Bold), Location = new Point(16, 16), Text = "BIMLog Lens Next" };
            var mode = new Label { AutoSize = true, Font = new Font("Segoe UI", 9F), Location = new Point(16, 52), Text = "Read-only exact-view navigation" };
            var boundary = new Label { AutoSize = true, Font = new Font("Segoe UI", 9F), ForeColor = DrawingColor.DimGray, Location = new Point(16, 80), Text = "Status, comments, assignment, capture, publishing, migration, and recovery are disabled." };
            panel.Controls.Add(title);
            panel.Controls.Add(mode);
            panel.Controls.Add(boundary);
            return panel;
        }

        public override void DestroyControlPane(Control pane)
        {
            pane?.Dispose();
        }
    }

    [Plugin("BIMLogLensNextButton", "IgniteSmart", DisplayName = "BIMLog Lens Next", ToolTip = "Open the read-only BIMLog Lens Next panel")]
    public sealed class BIMLogLensNextButtonPlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            var record = NavisworksApplication.Plugins.FindPlugin(LensNextConstants.DockPluginId);
            var pane = record?.TryLoadPlugin() as BIMLogLensNextDockPanePlugin;
            if (pane == null) return -1;
            pane.Visible = true;
            return 0;
        }
    }
}
