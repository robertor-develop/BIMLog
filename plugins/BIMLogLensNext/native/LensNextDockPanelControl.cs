using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Xml;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace BIMLogLensNext.Native
{
    public sealed class LensNextDockPanelControl : UserControl
    {
        private readonly LensNextNativeRuntime _runtime;
        private readonly WebView2 _webView = new WebView2();
        private readonly Panel _overlay = new Panel();
        private readonly Label _overlayTitle = new Label();
        private readonly Label _overlayBody = new Label();
        private readonly Button _connectButton = new Button();
        private readonly Label _status = new Label();
        private readonly Label _context = new Label();
        private readonly Button _reloadButton = new Button();
        private readonly Timer _healthTimer = new Timer();

        private bool _webViewReady;
        private bool _webViewInitializing;
        private bool _documentChangedBlocked;
        private bool _returnToLensNextAfterLogin;
        private string _lastAutomaticStartDocument;
        private Form _floatingHost;
        private FloatingHostCloseFilter _floatingHostCloseFilter;
        private const string M7_NATIVE_UX_FIX1 = "m7-native-ux-fix1";

        private static readonly Color Ink = Color.FromArgb(16, 37, 28);
        private static readonly Color Muted = Color.FromArgb(96, 112, 103);
        private static readonly Color Accent = Color.FromArgb(33, 163, 102);
        private static readonly Color Border = Color.FromArgb(219, 229, 223);
        private static readonly Color Surface = Color.FromArgb(247, 250, 248);
        private static readonly Color Warning = Color.FromArgb(180, 83, 9);
        private static readonly Color Error = Color.FromArgb(185, 28, 28);

        public LensNextDockPanelControl()
        {
            _runtime = new LensNextNativeRuntime(this);
            Dock = DockStyle.Fill;
            BackColor = Color.White;
            MinimumSize = new Size(300, 360);
            Font = new Font("Segoe UI", 9F);

            var root = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 2,
                Margin = Padding.Empty,
                Padding = Padding.Empty,
                BackColor = Color.White
            };
            root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100F));
            root.RowStyles.Add(new RowStyle(SizeType.Absolute, 46F));
            root.RowStyles.Add(new RowStyle(SizeType.Percent, 100F));
            Controls.Add(root);

            root.Controls.Add(CreateToolbar(), 0, 0);
            root.Controls.Add(CreateWorkspaceHost(), 0, 1);

            _healthTimer.Interval = 1500;
            _healthTimer.Tick += (sender, args) => HealthTick();

            Load += (sender, args) =>
            {
                UpdateChrome();
                StartRuntimeAndWorkspace(false, false);
                _healthTimer.Start();
            };
        }

        private Control CreateToolbar()
        {
            var bar = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = Color.White,
                Padding = new Padding(10, 7, 8, 6)
            };
            bar.Paint += (sender, args) =>
            {
                using (var pen = new Pen(Border))
                    args.Graphics.DrawLine(pen, 0, bar.Height - 1, bar.Width, bar.Height - 1);
            };

            var title = new Label
            {
                AutoSize = true,
                Location = new Point(10, 7),
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                ForeColor = Ink,
                Text = "BIMLog Lens Next"
            };
            bar.Controls.Add(title);

            _status.AutoSize = true;
            _status.Location = new Point(11, 27);
            _status.Font = new Font("Segoe UI", 7.5F, FontStyle.Bold);
            _status.ForeColor = Muted;
            bar.Controls.Add(_status);

            _context.AutoEllipsis = true;
            _context.TextAlign = ContentAlignment.MiddleRight;
            _context.ForeColor = Muted;
            _context.Font = new Font("Segoe UI", 7.5F);
            bar.Controls.Add(_context);

            _reloadButton.Text = "Refresh";
            _reloadButton.AutoSize = true;
            _reloadButton.FlatStyle = FlatStyle.Flat;
            _reloadButton.FlatAppearance.BorderColor = Border;
            _reloadButton.Click += (sender, args) =>
            {
                if (_runtime.IsRunning)
                    NavigateWorkspace(true);
                else
                    StartRuntimeAndWorkspace(true, true);
            };
            bar.Controls.Add(_reloadButton);

            var settings = new Button
            {
                Text = "Settings",
                AutoSize = true,
                FlatStyle = FlatStyle.Flat
            };
            settings.FlatAppearance.BorderColor = Border;
            settings.Click += (sender, args) => Settings();
            bar.Controls.Add(settings);

            var diagnostics = new Button
            {
                Text = "Diagnostics",
                AutoSize = true,
                FlatStyle = FlatStyle.Flat
            };
            diagnostics.FlatAppearance.BorderColor = Border;
            diagnostics.Click += (sender, args) => CopyDiagnostics();
            bar.Controls.Add(diagnostics);

            var exportXml = new Button
            {
                Text = "Export XML",
                AutoSize = true,
                FlatStyle = FlatStyle.Flat
            };
            exportXml.FlatAppearance.BorderColor = Border;
            exportXml.Click += (sender, args) => ExportViewpointsXml();
            bar.Controls.Add(exportXml);

            var createIssue = new Button
            {
                Text = "Create Issue",
                AutoSize = true,
                FlatStyle = FlatStyle.Flat
            };
            createIssue.FlatAppearance.BorderColor = Border;
            createIssue.Click += async (sender, args) =>
            {
                if (!_webViewReady || _webView.CoreWebView2 == null)
                {
                    MessageBox.Show("Connect Lens Next first.", "BIMLog Lens Next", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                await _webView.CoreWebView2.ExecuteScriptAsync("(() => { const form=document.querySelector('details.lens-next__create'); if(!form)return false; form.open=true; form.scrollIntoView({behavior:'smooth',block:'start'}); return true; })()");
            };
            bar.Controls.Add(createIssue);

            bar.Resize += (sender, args) =>
            {
                diagnostics.Location = new Point(Math.Max(210, bar.Width - diagnostics.Width - 8), 9);
                exportXml.Location = new Point(Math.Max(150, diagnostics.Left - exportXml.Width - 6), 9);
                createIssue.Location = new Point(Math.Max(100, exportXml.Left - createIssue.Width - 6), 9);
                settings.Location = new Point(Math.Max(60, createIssue.Left - settings.Width - 6), 9);
                _reloadButton.Location = new Point(Math.Max(92, settings.Left - _reloadButton.Width - 6), 9);
                _context.Location = new Point(Math.Max(170, _reloadButton.Left - 160), 24);
                _context.Size = new Size(Math.Max(0, _reloadButton.Left - _context.Left - 8), 16);
            };

            return bar;
        }

        private void ExportViewpointsXml()
        {
            try
            {
                using (var dialog = new SaveFileDialog
                {
                    Title = "Export BIMLog Saved Viewpoints",
                    Filter = "Navisworks Viewpoints XML (*.xml)|*.xml",
                    DefaultExt = "xml",
                    AddExtension = true,
                    FileName = "BIMLog-viewpoints-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".xml"
                })
                {
                    if (dialog.ShowDialog(this) != DialogResult.OK) return;
                    var bridgeType = ResolveComBridgeType();
                    if (bridgeType == null) throw new InvalidOperationException("Navisworks COM export bridge is unavailable.");
                    var stateProperty = bridgeType.GetProperty("State", BindingFlags.Public | BindingFlags.Static);
                    var state = stateProperty == null ? null : stateProperty.GetValue(null, null);
                    if (state == null) throw new InvalidOperationException("Navisworks export state is unavailable.");
                    var result = ExportViewpointsXmlCore(state, stateProperty.PropertyType, dialog.FileName);
                    MessageBox.Show("VIEWPOINT XML EXPORT PASS\r\n" + dialog.FileName, "BIMLog Lens Next", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    LensNextNativeLog.Info("Viewpoint XML export complete. Status=" + result + " Path=" + dialog.FileName);
                }
            }
            catch (Exception ex)
            {
                LensNextNativeLog.Error("Viewpoint XML export failed.", ex);
                MessageBox.Show(ex.InnerException == null ? ex.Message : ex.InnerException.Message, "BIMLog Lens Next XML Export", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private static Type ResolveComBridgeType()
        {
            const string typeName = "Autodesk.Navisworks.Api.ComApi.ComApiBridge";
            var loaded = AppDomain.CurrentDomain.GetAssemblies()
                .Select(assembly => assembly.GetType(typeName, false))
                .FirstOrDefault(type => type != null);
            if (loaded != null) return loaded;

            try
            {
                var assembly = Assembly.Load("Autodesk.Navisworks.ComApi");
                var resolved = assembly == null ? null : assembly.GetType(typeName, false);
                if (resolved != null) return resolved;
            }
            catch (Exception)
            {
                // The fallback below also covers Navisworks releases that expose the bridge elsewhere.
            }

            return Type.GetType(typeName + ", Autodesk.Navisworks.ComApi", false)
                ?? Type.GetType(typeName + ", Autodesk.Navisworks.Api", false);
        }

        private static string ExportViewpointsXmlCore(object state, Type stateContract, string destinationPath)
        {
            if (state == null) throw new ArgumentNullException(nameof(state));
            if (stateContract == null) throw new ArgumentNullException(nameof(stateContract));
            if (string.IsNullOrWhiteSpace(destinationPath)) throw new ArgumentException("An XML destination is required.", nameof(destinationPath));

            var fullPath = Path.GetFullPath(destinationPath);
            var directory = Path.GetDirectoryName(fullPath);
            if (string.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory))
                throw new DirectoryNotFoundException("The XML export directory does not exist: " + directory);

            const string pluginName = "XmlViewpointsExportPlugin";
            var getOptions = FindComContractMethod(stateContract, "GetIOPluginOptions", 1);
            if (getOptions == null) throw new InvalidOperationException("Navisworks XML export options command is unavailable.");
            var drive = FindComContractMethod(stateContract, "DriveIOPlugin", 3);
            if (drive == null) throw new InvalidOperationException("Navisworks XML export command is unavailable.");

            var temporaryPath = Path.Combine(
                directory,
                "." + Path.GetFileName(fullPath) + "." + Guid.NewGuid().ToString("N") + ".tmp.xml");
            try
            {
                var propertyVector = InvokeComContractMethod(getOptions, state, new object[] { pluginName }, "create XML export options");
                if (propertyVector == null) throw new InvalidOperationException("Navisworks XML export options could not be created.");

                var result = InvokeComContractMethod(
                    drive,
                    state,
                    new[] { (object)pluginName, temporaryPath, propertyVector },
                    "export viewpoints XML");
                var status = Convert.ToInt32(result);
                if (status != 0)
                    throw new InvalidOperationException("Navisworks XML export failed with status " + Convert.ToString(result) + " (" + status + ").");

                ValidateExportedXml(temporaryPath);
                if (File.Exists(fullPath)) File.Replace(temporaryPath, fullPath, null);
                else File.Move(temporaryPath, fullPath);
                return Convert.ToString(result);
            }
            finally
            {
                if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
            }
        }

        private static object InvokeComContractMethod(MethodInfo method, object target, object[] arguments, string operation)
        {
            try
            {
                return method.Invoke(target, arguments);
            }
            catch (TargetInvocationException exception)
            {
                var cause = exception.InnerException ?? exception;
                throw new InvalidOperationException("Navisworks could not " + operation + ": " + cause.Message, cause);
            }
        }

        private static void ValidateExportedXml(string path)
        {
            if (!File.Exists(path)) throw new InvalidOperationException("Navisworks did not create the XML export.");
            if (new FileInfo(path).Length == 0) throw new InvalidOperationException("Navisworks created an empty XML export.");

            var document = new XmlDocument { XmlResolver = null };
            document.Load(path);
            if (document.DocumentElement == null) throw new InvalidOperationException("Navisworks created XML without a document element.");
        }

        private static MethodInfo FindComContractMethod(Type stateContract, string name, int parameterCount)
        {
            if (stateContract == null) return null;

            return new[] { stateContract }
                .Concat(stateContract.GetInterfaces())
                .SelectMany(contract => contract.GetMethods())
                .FirstOrDefault(candidate =>
                    candidate.Name == name &&
                    candidate.GetParameters().Length == parameterCount);
        }

        private Control CreateWorkspaceHost()
        {
            var host = new Panel { Dock = DockStyle.Fill, BackColor = Surface };

            _webView.Dock = DockStyle.Fill;
            _webView.Visible = false;
            host.Controls.Add(_webView);

            _overlay.Dock = DockStyle.Fill;
            _overlay.BackColor = Surface;
            host.Controls.Add(_overlay);

            var content = new Panel
            {
                Width = 360,
                Height = 250,
                BackColor = Color.White
            };
            content.Paint += (sender, args) =>
            {
                using (var pen = new Pen(Border))
                    args.Graphics.DrawRectangle(pen, 0, 0, content.Width - 1, content.Height - 1);
            };
            _overlay.Controls.Add(content);

            _overlay.Resize += (sender, args) =>
            {
                content.Left = Math.Max(12, (_overlay.ClientSize.Width - content.Width) / 2);
                content.Top = Math.Max(12, (_overlay.ClientSize.Height - content.Height) / 2);
                content.Width = Math.Min(420, Math.Max(276, _overlay.ClientSize.Width - 24));
            };

            var eyebrow = new Label
            {
                AutoSize = true,
                Location = new Point(18, 18),
                Font = new Font("Segoe UI", 8F, FontStyle.Bold),
                ForeColor = Accent,
                Text = "LENS NEXT · EMBEDDED WORKSPACE"
            };
            content.Controls.Add(eyebrow);

            _overlayTitle.AutoSize = false;
            _overlayTitle.Location = new Point(18, 48);
            _overlayTitle.Size = new Size(320, 34);
            _overlayTitle.Font = new Font("Segoe UI", 14F, FontStyle.Bold);
            _overlayTitle.ForeColor = Ink;
            content.Controls.Add(_overlayTitle);

            _overlayBody.AutoSize = false;
            _overlayBody.Location = new Point(18, 88);
            _overlayBody.Size = new Size(320, 72);
            _overlayBody.ForeColor = Muted;
            content.Controls.Add(_overlayBody);

            _connectButton.Text = "Connect Current Model";
            _connectButton.AutoSize = true;
            _connectButton.BackColor = Accent;
            _connectButton.ForeColor = Color.White;
            _connectButton.FlatStyle = FlatStyle.Flat;
            _connectButton.FlatAppearance.BorderSize = 0;
            _connectButton.Location = new Point(18, 175);
            _connectButton.Padding = new Padding(8, 3, 8, 3);
            _connectButton.Click += (sender, args) => StartRuntimeAndWorkspace(true, true);
            content.Controls.Add(_connectButton);

            var browser = new Button
            {
                Text = "Open in Browser",
                AutoSize = true,
                FlatStyle = FlatStyle.Flat,
                Location = new Point(170, 175),
                Padding = new Padding(7, 3, 7, 3)
            };
            browser.FlatAppearance.BorderColor = Border;
            browser.Click += (sender, args) =>
            {
                var config = LensNextNativeConfig.Load();
                OpenExternal(config.WebUri().ToString().TrimEnd('/') + "/lens-next");
            };
            content.Controls.Add(browser);

            var version = new Label
            {
                AutoSize = true,
                Location = new Point(18, 222),
                ForeColor = Muted,
                Font = new Font("Segoe UI", 7.5F),
                Text = LensNextConstants.ProductVersionLabel + " · Navisworks " + ThisAssemblyProductYear.Value + " · read-only"
            };
            content.Controls.Add(version);

            ShowOverlay("Connecting to BIMLog…", "Lens Next is preparing the local bridge and embedded BIMLog workspace.", false);
            return host;
        }

        private void StartRuntimeAndWorkspace(bool showErrors, bool explicitReconnect)
        {
            var readiness = _runtime.ReadinessMessage();
            if (!string.Equals(readiness, "Ready", StringComparison.Ordinal))
            {
                ShowOverlay("Setup required", readiness, false);
                UpdateChrome();
                return;
            }

            if (_documentChangedBlocked && !explicitReconnect)
            {
                ShowOverlay(
                    "Model changed",
                    "Lens Next stopped the previous bridge fail-closed. Confirm this model belongs to the configured BIMLog project, then connect it explicitly.",
                    true);
                UpdateChrome();
                return;
            }

            try
            {
                if (_runtime.IsRunning && !explicitReconnect)
                {
                    LensNextNativeLog.Info("Lens Next startup reused the healthy native bridge.");
                    _documentChangedBlocked = false;
                    InitializeWebView(false);
                    return;
                }
                _runtime.StartOrRestart();
                _documentChangedBlocked = false;
                ShowOverlay("Opening Lens Next…", "The BIMLog workspace is loading inside Navisworks.", false);
                InitializeWebView(true);
            }
            catch (Exception ex)
            {
                LensNextNativeLog.Error("Native runtime failed to start.", ex);
                ShowOverlay("Lens Next could not start", ex.Message, true);
                if (showErrors)
                {
                    MessageBox.Show(
                        ex.Message,
                        "BIMLog Lens Next",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                }
            }
            finally
            {
                UpdateChrome();
            }
        }

        private async void InitializeWebView(bool forceNavigation)
        {
            if (_webViewInitializing) return;
            _webViewInitializing = true;
            try
            {
                if (!_webViewReady)
                {
                    try
                    {
                        CoreWebView2Environment.GetAvailableBrowserVersionString();
                    }
                    catch (WebView2RuntimeNotFoundException)
                    {
                        ShowOverlay(
                            "WebView2 Runtime required",
                            "Lens Next uses Microsoft Edge WebView2 to place the BIMLog interface directly inside Navisworks. Install the Evergreen WebView2 Runtime, then click Connect Current Model.",
                            true);
                        return;
                    }

                    Directory.CreateDirectory(LensNextNativeConfig.WebViewProfileDirectory);
                    var environment = await CoreWebView2Environment.CreateAsync(
                        null,
                        LensNextNativeConfig.WebViewProfileDirectory);
                    await _webView.EnsureCoreWebView2Async(environment);

                    _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
                    _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                    _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                    _webView.CoreWebView2.NavigationStarting += WebViewNavigationStarting;
                    _webView.CoreWebView2.NavigationCompleted += WebViewNavigationCompleted;
                    _webView.CoreWebView2.SourceChanged += WebViewSourceChanged;
                    _webView.CoreWebView2.NewWindowRequested += WebViewNewWindowRequested;
                    _webViewReady = true;
                    LensNextNativeLog.Info("Embedded WebView2 workspace initialized.");
                }

                _webView.Visible = true;
                _overlay.Visible = false;
                if (forceNavigation || _webView.Source == null || !IsLensNextUrl(_webView.Source.ToString()))
                    NavigateWorkspace(true);
            }
            catch (Exception ex)
            {
                LensNextNativeLog.Error("Embedded Lens Next workspace initialization failed.", ex);
                ShowOverlay("Embedded workspace unavailable", ex.Message, true);
            }
            finally
            {
                _webViewInitializing = false;
                UpdateChrome();
            }
        }

        private void WebViewNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs args)
        {
            if (string.IsNullOrWhiteSpace(args.Uri) || string.Equals(args.Uri, "about:blank", StringComparison.OrdinalIgnoreCase))
                return;

            if (!IsConfiguredWebOrigin(args.Uri))
            {
                args.Cancel = true;
                OpenExternal(args.Uri);
                return;
            }

            Uri uri;
            if (Uri.TryCreate(args.Uri, UriKind.Absolute, out uri) && uri.AbsolutePath.Equals("/login", StringComparison.OrdinalIgnoreCase))
                _returnToLensNextAfterLogin = true;
        }

        private void WebViewNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (!args.IsSuccess)
            {
                ShowOverlay(
                    "BIMLog workspace did not load",
                    "The embedded BIMLog page returned a navigation error. Check your connection and Lens Next web URL, then retry.",
                    true);
                return;
            }

            if (_runtime.IsRunning)
            {
                _webView.Visible = true;
                _overlay.Visible = false;
            }
        }

        private void WebViewSourceChanged(object sender, CoreWebView2SourceChangedEventArgs args)
        {
            if (!_webViewReady || _webView.Source == null) return;
            var source = _webView.Source.ToString();
            Uri uri;
            if (!Uri.TryCreate(source, UriKind.Absolute, out uri) || !IsConfiguredWebOrigin(source)) return;

            if (uri.AbsolutePath.Equals("/login", StringComparison.OrdinalIgnoreCase))
            {
                _returnToLensNextAfterLogin = true;
                return;
            }

            if (_returnToLensNextAfterLogin)
            {
                _returnToLensNextAfterLogin = false;
                if (!IsLensNextUrl(source))
                    NavigateWorkspace(true);
            }
        }

        private void WebViewNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs args)
        {
            args.Handled = true;
            OpenExternal(args.Uri);
        }

        private void NavigateWorkspace(bool force)
        {
            if (!_runtime.IsRunning)
            {
                ShowOverlay("Bridge not running", _runtime.ReadinessMessage(), true);
                return;
            }

            if (!_webViewReady)
            {
                InitializeWebView(force);
                return;
            }

            var url = LensNextNativeConfig.Load().LensNextUrl(_runtime.BridgeOrigin);
            if (force || _webView.Source == null || !string.Equals(_webView.Source.ToString(), url, StringComparison.OrdinalIgnoreCase))
            {
                LensNextNativeLog.Info("Navigating embedded workspace to " + url);
                _webView.CoreWebView2.Navigate(url);
            }
        }

        private bool IsConfiguredWebOrigin(string raw)
        {
            try
            {
                Uri candidate;
                if (!Uri.TryCreate(raw, UriKind.Absolute, out candidate)) return false;
                var configured = LensNextNativeConfig.Load().WebUri();
                return string.Equals(
                    candidate.GetLeftPart(UriPartial.Authority).TrimEnd('/'),
                    configured.GetLeftPart(UriPartial.Authority).TrimEnd('/'),
                    StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private bool IsLensNextUrl(string raw)
        {
            Uri uri;
            return Uri.TryCreate(raw, UriKind.Absolute, out uri) &&
                IsConfiguredWebOrigin(raw) &&
                uri.AbsolutePath.Equals("/lens-next", StringComparison.OrdinalIgnoreCase) &&
                uri.Query.IndexOf("launch=navisworks", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        public void RestoreHostWindow()
        {
            if (IsDisposed) return;
            if (InvokeRequired)
            {
                BeginInvoke(new Action(RestoreHostWindow));
                return;
            }
            NormalizeFloatingHostWindow(true);
        }

        private void NormalizeFloatingHostWindow(bool restoreWindow)
        {
            var floating = FindForm();
            if (floating == null ||
                !string.Equals(floating.Text, "BIMLog Lens Next", StringComparison.OrdinalIgnoreCase))
                return;

            try
            {
                if (!ReferenceEquals(_floatingHost, floating))
                {
                    if (_floatingHost != null)
                        _floatingHost.FormClosing -= FloatingHostFormClosing;
                    if (_floatingHostCloseFilter != null)
                    {
                        Application.RemoveMessageFilter(_floatingHostCloseFilter);
                        _floatingHostCloseFilter = null;
                    }
                    _floatingHost = floating;
                    _floatingHost.FormClosing += FloatingHostFormClosing;
                    _floatingHostCloseFilter = new FloatingHostCloseFilter(
                        _floatingHost,
                        () => LensNextNativeLog.Info("Floating workspace window hidden; Lens Next command can restore it."));
                    Application.AddMessageFilter(_floatingHostCloseFilter);
                }

                if (!floating.ControlBox)
                {
                    floating.ControlBox = true;
                }
                // The floating Lens Next workspace is a normal user-resizable window.
                // Its ribbon command explicitly restores a minimized host.
                if (!floating.MinimizeBox)
                {
                    floating.MinimizeBox = true;
                }
                if (!floating.MaximizeBox)
                {
                    floating.MaximizeBox = true;
                }
                if (floating.FormBorderStyle != FormBorderStyle.Sizable)
                {
                    floating.FormBorderStyle = FormBorderStyle.Sizable;
                }
                ForceNativeFloatingWindowChrome(floating);

                var area = Screen.FromControl(floating).WorkingArea;
                var isOutside = !area.IntersectsWith(floating.Bounds);
                var isOversized = floating.Width > area.Width || floating.Height > area.Height;
                if (restoreWindow && floating.WindowState == FormWindowState.Minimized)
                {
                    floating.WindowState = FormWindowState.Normal;
                }

                if (isOutside || isOversized || floating.Width < 300 || floating.Height < 360)
                {
                    var width = Math.Min(1100, Math.Max(720, area.Width - 80));
                    var height = Math.Min(760, Math.Max(560, area.Height - 80));
                    floating.Bounds = new Rectangle(
                        area.Left + Math.Max(0, (area.Width - width) / 2),
                        area.Top + Math.Max(0, (area.Height - height) / 2),
                        width,
                        height);
                }

                if (restoreWindow)
                {
                    if (!floating.Visible)
                        floating.Show();
                    floating.BringToFront();
                    floating.Activate();
                }

                if (restoreWindow)
                    LensNextNativeLog.Info("Floating workspace window restored.");
            }
            catch (Exception ex)
            {
                LensNextNativeLog.Warn("Floating workspace window could not be normalized: " + ex.Message);
            }
        }

        private static void ForceNativeFloatingWindowChrome(Form floating)
        {
            if (floating == null || floating.IsDisposed || !floating.IsHandleCreated)
                return;

            const int GwlStyle = -16;
            const int WsSysMenu = 0x00080000;
            const int WsThickFrame = 0x00040000;
            const int WsMinimizeBox = 0x00020000;
            const int WsMaximizeBox = 0x00010000;
            const uint SwpNoSize = 0x0001;
            const uint SwpNoMove = 0x0002;
            const uint SwpNoZOrder = 0x0004;
            const uint SwpNoActivate = 0x0010;
            const uint SwpFrameChanged = 0x0020;

            var style = GetWindowLong(floating.Handle, GwlStyle);
            var required = WsSysMenu | WsThickFrame | WsMinimizeBox | WsMaximizeBox;
            if ((style & required) != required)
                SetWindowLong(floating.Handle, GwlStyle, style | required);

            SetWindowPos(
                floating.Handle,
                IntPtr.Zero,
                0,
                0,
                0,
                0,
                SwpNoSize | SwpNoMove | SwpNoZOrder | SwpNoActivate | SwpFrameChanged);
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int GetWindowLong(IntPtr window, int index);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern int SetWindowLong(IntPtr window, int index, int value);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(
            IntPtr window,
            IntPtr insertAfter,
            int x,
            int y,
            int width,
            int height,
            uint flags);

        private void FloatingHostFormClosing(object sender, FormClosingEventArgs args)
        {
            if (args.CloseReason != CloseReason.UserClosing || IsDisposed)
                return;

            args.Cancel = true;
            var floating = sender as Form;
            if (floating != null)
                floating.Hide();
            LensNextNativeLog.Info("Floating workspace window hidden; Lens Next command can restore it.");
        }

        private sealed class FloatingHostCloseFilter : IMessageFilter
        {
            private const int WmSysCommand = 0x0112;
            private const int ScClose = 0xF060;
            private readonly Form _host;
            private readonly Action _onHidden;

            public FloatingHostCloseFilter(Form host, Action onHidden)
            {
                _host = host;
                _onHidden = onHidden;
            }

            public bool PreFilterMessage(ref Message message)
            {
                if (_host == null || _host.IsDisposed ||
                    message.HWnd != _host.Handle || message.Msg != WmSysCommand ||
                    ((int)message.WParam & 0xFFF0) != ScClose)
                    return false;

                _host.Hide();
                _onHidden();
                return true;
            }
        }

        private void ShowOverlay(string title, string body, bool canReconnect)
        {
            _overlayTitle.Text = title;
            _overlayBody.Text = body;
            _connectButton.Enabled = canReconnect && string.Equals(_runtime.ReadinessMessage(), "Ready", StringComparison.Ordinal);
            _overlay.Visible = true;
            _overlay.BringToFront();
            if (_webViewReady) _webView.Visible = false;
        }

        private void UpdateChrome()
        {
            var config = LensNextNativeConfig.Load();
            var readiness = _runtime.ReadinessMessage();
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var fileName = document == null || document.IsDisposed || document.IsClear || string.IsNullOrWhiteSpace(document.FileName)
                ? "No model"
                : Path.GetFileName(document.FileName);

            if (_runtime.IsRunning)
            {
                _status.Text = "● LIVE · " + LensNextConstants.ProductVersionLabel;
                _status.ForeColor = Accent;
            }
            else if (_documentChangedBlocked)
            {
                _status.Text = "● MODEL CHANGED";
                _status.ForeColor = Warning;
            }
            else if (string.Equals(readiness, "Ready", StringComparison.Ordinal))
            {
                _status.Text = "● READY · " + LensNextConstants.ProductVersionLabel;
                _status.ForeColor = Accent;
            }
            else
            {
                _status.Text = "● SETUP REQUIRED";
                _status.ForeColor = Warning;
            }

            _context.Text = (config.ProjectId > 0 ? "P" + config.ProjectId : "No project") + " · " + fileName;
            _reloadButton.Text = _runtime.IsRunning ? "Refresh" : "Connect";
            _reloadButton.Enabled = _runtime.IsRunning || string.Equals(readiness, "Ready", StringComparison.Ordinal);
        }

        private void HealthTick()
        {
            var readiness = _runtime.ReadinessMessage();
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            var documentKey = document == null || document.IsDisposed || document.IsClear
                ? null
                : document.FileName;

            if (_runtime.IsRunning && !_runtime.ActiveDocumentMatches())
            {
                LensNextNativeLog.Info("Active Navisworks document changed. Rotating the embedded bridge to the new model.");
                _runtime.Stop();
                _documentChangedBlocked = false;
                _lastAutomaticStartDocument = null;
                ShowOverlay(
                    "Switching model",
                    "Lens Next is reconnecting to the current model and resolving its BIMLog project binding automatically.",
                    false);
            }
            else if (!_runtime.IsRunning &&
                     !_documentChangedBlocked &&
                     string.Equals(readiness, "Ready", StringComparison.Ordinal) &&
                     !string.IsNullOrWhiteSpace(documentKey) &&
                     !string.Equals(_lastAutomaticStartDocument, documentKey, StringComparison.OrdinalIgnoreCase))
            {
                _lastAutomaticStartDocument = documentKey;
                LensNextNativeLog.Info("Navisworks model became ready after panel creation. Starting Lens Next automatically.");
                StartRuntimeAndWorkspace(false, false);
                return;
            }
            else if (!string.Equals(readiness, "Ready", StringComparison.Ordinal))
            {
                _lastAutomaticStartDocument = null;
            }

            UpdateChrome();
        }

        private void Settings()
        {
            var config = LensNextNativeConfig.Load();
            using (var form = new LensNextSettingsForm(config))
            {
                if (form.ShowDialog(this) == DialogResult.OK)
                {
                    _documentChangedBlocked = false;
                    StartRuntimeAndWorkspace(true, true);
                }
            }
        }

        private void OpenExternal(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return;
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "BIMLog Lens Next", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void CopyDiagnostics()
        {
            var config = LensNextNativeConfig.Load();
            var document = Autodesk.Navisworks.Api.Application.ActiveDocument;
            string webViewVersion = "<not available>";
            try { webViewVersion = CoreWebView2Environment.GetAvailableBrowserVersionString(); } catch { }

            var value =
                "BIMLog Lens Next " + LensNextConstants.ProductVersionLabel + Environment.NewLine +
                "Embedded workspace: " + _webViewReady + Environment.NewLine +
                "WebView2 runtime: " + webViewVersion + Environment.NewLine +
                "Bridge running: " + _runtime.IsRunning + Environment.NewLine +
                "Bridge origin: " + (_runtime.BridgeOrigin ?? "<not allocated>") + Environment.NewLine +
                "Project ID: " + config.ProjectId + Environment.NewLine +
                "Document: " + (document == null ? "<none>" : document.FileName) + Environment.NewLine +
                "Model fingerprint: " + (_runtime.ModelFingerprint ?? "<not computed>") + Environment.NewLine +
                "Session expires: " + (_runtime.SessionExpiresAt.HasValue ? _runtime.SessionExpiresAt.Value.ToString("o") : "<none>") + Environment.NewLine +
                "Readiness: " + _runtime.ReadinessMessage() + Environment.NewLine +
                "Last error: " + (_runtime.LastError ?? "<none>") + Environment.NewLine +
                "Web URL: " + config.BimLogWebUrl + Environment.NewLine +
                "Log: " + LensNextNativeLog.LogPath;

            try
            {
                Clipboard.SetText(value);
                MessageBox.Show("Lens Next diagnostics copied to clipboard.", "BIMLog Lens Next", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch
            {
                MessageBox.Show(value, "BIMLog Lens Next Diagnostics", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_floatingHost != null)
                {
                    _floatingHost.FormClosing -= FloatingHostFormClosing;
                    _floatingHost = null;
                }
                if (_floatingHostCloseFilter != null)
                {
                    Application.RemoveMessageFilter(_floatingHostCloseFilter);
                    _floatingHostCloseFilter = null;
                }
                _healthTimer.Stop();
                _healthTimer.Dispose();
                if (_webView != null) _webView.Dispose();
                _runtime.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
