using System;
using System.Drawing;
using System.Linq;
using System.Windows.Forms;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextSettingsForm : Form
    {
        private readonly TextBox _webUrl = new TextBox();
        private readonly NumericUpDown _projectId = new NumericUpDown();
        private readonly NumericUpDown _refreshSeconds = new NumericUpDown();
        private readonly TextBox _origins = new TextBox();

        public LensNextSettingsForm(LensNextNativeConfig config)
        {
            Text = "BIMLog Lens Next Settings";
            Font = new Font("Segoe UI", 9F);
            Width = 640; Height = 420; StartPosition = FormStartPosition.CenterParent;
            var table = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), ColumnCount = 2, RowCount = 6, AutoSize = true };
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 180));
            table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(table);

            _webUrl.Text = config.BimLogWebUrl;
            _projectId.Minimum = 0; _projectId.Maximum = 999999999; _projectId.Value = Math.Max(0, config.ProjectId);
            _projectId.Enabled = false;
            _refreshSeconds.Minimum = 5; _refreshSeconds.Maximum = 300; _refreshSeconds.Value = config.AutoRefreshSeconds;
            _origins.Multiline = true; _origins.Height = 90; _origins.Text = string.Join(Environment.NewLine, config.AllowedWebOrigins ?? new System.Collections.Generic.List<string>());
            AddRow(table, 0, "BIMLog web URL", _webUrl);
            AddRow(table, 1, "Bound Project ID (automatic)", _projectId);
            AddRow(table, 2, "Auto refresh (seconds)", _refreshSeconds);
            AddRow(table, 3, "Allowed web origins", _origins);
            var note = new Label { AutoSize = true, ForeColor = Color.DimGray, Text = "Project binding is controlled by BIMLog and cannot be selected here. Lens Next stores configuration only under %LOCALAPPDATA%\\BIMLog\\LensNext. No Legacy settings are read or changed.", MaximumSize = new Size(400, 0) };
            table.Controls.Add(note, 1, 4);
            var buttons = new FlowLayoutPanel { AutoSize = true, FlowDirection = FlowDirection.RightToLeft, Dock = DockStyle.Fill };
            var save = new Button { Text = "Save", AutoSize = true };
            var cancel = new Button { Text = "Cancel", AutoSize = true, DialogResult = DialogResult.Cancel };
            save.Click += (sender, args) => SaveConfig(config);
            buttons.Controls.Add(save); buttons.Controls.Add(cancel); table.Controls.Add(buttons, 1, 5);
            AcceptButton = save; CancelButton = cancel;
        }

        private static void AddRow(TableLayoutPanel table, int row, string label, Control control)
        {
            table.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left }, 0, row);
            control.Dock = DockStyle.Fill; table.Controls.Add(control, 1, row);
        }

        private void SaveConfig(LensNextNativeConfig config)
        {
            config.BimLogWebUrl = _webUrl.Text.Trim();
            config.AutoRefreshSeconds = Convert.ToInt32(_refreshSeconds.Value);
            config.AllowedWebOrigins = _origins.Lines.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value.Trim()).ToList();
            try { config.WebUri(); config.Save(); DialogResult = DialogResult.OK; Close(); }
            catch (Exception ex) { MessageBox.Show(ex.Message, "Lens Next Settings", MessageBoxButtons.OK, MessageBoxIcon.Warning); }
        }
    }
}
