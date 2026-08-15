using System;
using System.Collections.Generic;
using System.Threading;
using BIMLogLensNext;

namespace BIMLogLensNext.Native.Tests
{
    internal static class AdapterContractTests
    {
        private const string Fingerprint = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        private static int _passed;

        private static int Main()
        {
            try
            {
                Run("product_year_is_exact", () => Equal(ExpectedProductYear.Value, NativeReferenceBinding.ProductYear));
                Run("sdk_version_is_bound", () => True(!string.IsNullOrWhiteSpace(NativeReferenceBinding.NavisworksApiAssemblyVersion)));
                Run("contract_requires_positive_project", PositiveProjectRequired);
                Run("contract_requires_sha256_model", Sha256Required);
                Run("exact_context_and_guid_match", ExactContextAndGuidMatch);
                Run("missing_or_zero_guid_denies", MissingOrZeroGuidDenies);
                Run("mismatched_project_or_model_denies", MismatchedContextDenies);
                Run("ui_dispatcher_allows_owner_thread", OwnerThreadAllowed);
                Run("ui_dispatcher_denies_background_thread", BackgroundThreadDenied);
                Run("phase2_commands_remain_absent", Phase2CommandsRemainAbsent);
                Console.WriteLine("PASS " + _passed + "/10 Navisworks " + ExpectedProductYear.Value);
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("FAIL " + exception.Message);
                return 1;
            }
        }

        private static void PositiveProjectRequired()
        {
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("0", Fingerprint));
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("not-an-id", Fingerprint));
        }

        private static void Sha256Required()
        {
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("1", "model-label"));
            Throws<ArgumentException>(() => new AutodeskReadOnlyAdapterContract("1", new string('g', 64)));
        }

        private static void ExactContextAndGuidMatch()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            True(contract.Matches(Identity("1", Fingerprint, "11111111-2222-3333-4444-555555555555")));
        }

        private static void MissingOrZeroGuidDenies()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            False(contract.Matches(Identity("1", Fingerprint, null)));
            False(contract.Matches(Identity("1", Fingerprint, Guid.Empty.ToString())));
            False(contract.Matches(Identity("1", Fingerprint, "not-a-guid")));
        }

        private static void MismatchedContextDenies()
        {
            var contract = new AutodeskReadOnlyAdapterContract("1", Fingerprint);
            False(contract.Matches(Identity("2", Fingerprint, Guid.NewGuid().ToString())));
            False(contract.Matches(Identity("1", new string('a', 64), Guid.NewGuid().ToString())));
        }

        private static void OwnerThreadAllowed()
        {
            var dispatcher = new AutodeskNavisworksUiThreadDispatcher();
            Equal(7, dispatcher.Invoke(() => 7));
        }

        private static void BackgroundThreadDenied()
        {
            var dispatcher = new AutodeskNavisworksUiThreadDispatcher();
            Exception observed = null;
            var thread = new Thread(() =>
            {
                try { dispatcher.Invoke(() => true); }
                catch (Exception exception) { observed = exception; }
            });
            thread.Start(); thread.Join();
            True(observed is InvalidOperationException);
        }

        private static void Phase2CommandsRemainAbsent()
        {
            Equal(4, LensNextBridgeCommands.ReadOnlyCommands.Count);
            foreach (var command in LensNextBridgeCommands.ReadOnlyCommands)
            {
                False(command.StartsWith("phase2-", StringComparison.Ordinal));
            }
        }

        private static ImmutableWorkingViewIdentity Identity(string project, string model, string guid) =>
            new ImmutableWorkingViewIdentity { ProjectId = project, ModelFingerprint = model, NavisworksGuid = guid };
        private static void Run(string name, Action test) { test(); _passed++; Console.WriteLine("PASS " + name); }
        private static void True(bool value) { if (!value) throw new InvalidOperationException("Expected true."); }
        private static void False(bool value) { if (value) throw new InvalidOperationException("Expected false."); }
        private static void Equal<T>(T expected, T actual) { if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new InvalidOperationException("Expected " + expected + ", received " + actual + "."); }
        private static void Throws<T>(Action action) where T : Exception { try { action(); } catch (T) { return; } throw new InvalidOperationException("Expected " + typeof(T).Name + "."); }
    }
}
