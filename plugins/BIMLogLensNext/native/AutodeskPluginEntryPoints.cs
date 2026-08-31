using System;
using System.Windows.Forms;
using Autodesk.Navisworks.Api.Plugins;

namespace BIMLogLensNext.Native
{
    [Plugin(
        "BIMLogLensNext",
        "IgniteSmart",
        DisplayName = "BIMLog Lens Next",
        ToolTip = "Open BIMLog Lens Next")]
    [DockPanePlugin(
        360,
        600,
        FixedSize = false,
        AutoScroll = true,
        MinimumWidth = 300,
        MinimumHeight = 360)]
    public sealed class BIMLogLensNextDockPanePlugin : DockPanePlugin
    {
        private LensNextDockPanelControl _panel;

        public override Control CreateControlPane()
        {
            _panel = new LensNextDockPanelControl();
            _panel.Dock = DockStyle.Fill;
            return _panel;
        }

        public override void DestroyControlPane(Control pane)
        {
            if (pane != null)
                pane.Dispose();
            if (ReferenceEquals(_panel, pane))
                _panel = null;
        }

        public void ShowPane()
        {
            Visible = true;
            ActivatePane();
            if (_panel != null && !_panel.IsDisposed)
                _panel.RestoreHostWindow();
        }

        public override void OnVisibleChanged()
        {
            base.OnVisibleChanged();
            if (Visible && _panel != null && !_panel.IsDisposed)
                _panel.RestoreHostWindow();
        }
    }

    [Plugin(
        "BIMLogLensNextButton",
        "IgniteSmart",
        DisplayName = "BIMLog Lens Next",
        ToolTip = "Open BIMLog Lens Next")]
    [AddInPlugin(AddInLocation.AddIn)]
    public sealed class BIMLogLensNextButtonPlugin : AddInPlugin
    {
        public override int Execute(params string[] parameters)
        {
            try
            {
                var pluginRecord =
                    Autodesk.Navisworks.Api.Application.Plugins.FindPlugin(
                        "BIMLogLensNext.IgniteSmart");

                if (pluginRecord is DockPanePluginRecord dockRecord &&
                    dockRecord.IsEnabled)
                {
                    var dockPlugin =
                        dockRecord.LoadedPlugin as DockPanePlugin ??
                        dockRecord.LoadPlugin() as DockPanePlugin;

                    var lensNextPane = dockPlugin as BIMLogLensNextDockPanePlugin;
                    if (lensNextPane != null)
                    {
                        lensNextPane.ShowPane();
                    }
                    else if (dockPlugin != null)
                    {
                        dockPlugin.Visible = true;
                        dockPlugin.ActivatePane();
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "BIMLog Lens Next: " + ex.Message,
                    "BIMLog Lens Next",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }

            return 0;
        }
    }
}
