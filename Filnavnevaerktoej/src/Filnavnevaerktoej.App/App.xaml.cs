using System.Windows;
using System.Windows.Threading;
using Filnavnevaerktoej.App.ViewModels;
using Filnavnevaerktoej.App.Views;
using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.App;

public partial class App : System.Windows.Application
{
    public const string ProgramVersion = "1.0.0";

    private IAppLogger? _logger;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        AppPaths.SikrMapperFindes();
        _logger = new FileAppLogger();
        _logger.Info($"Programstart. Version {ProgramVersion}.");

        DispatcherUnhandledException += OnDispatcherUnhandledException;
        AppDomain.CurrentDomain.UnhandledException += OnAppDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        var fileDiscovery = new FileDiscoveryService();
        var fileValidation = new FileValidationService();
        var historyService = new HistoryService();
        var profileService = new ProfileService();
        var reportService = new CsvReportService();
        var renameService = new RenameService(fileValidation, historyService, _logger);

        var wizardViewModel = new WizardViewModel(
            fileDiscovery,
            renameService,
            historyService,
            profileService,
            reportService,
            _logger);

        var mainWindow = new MainWindow { DataContext = wizardViewModel };
        MainWindow = mainWindow;
        mainWindow.Show();
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        HaandterUventetFejl(e.Exception);
        e.Handled = true;
    }

    private void OnAppDomainUnhandledException(object sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is Exception ex)
            HaandterUventetFejl(ex);
    }

    private void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        HaandterUventetFejl(e.Exception);
        e.SetObserved();
    }

    private void HaandterUventetFejl(Exception exception)
    {
        _logger?.Fejl("Uventet, ubehandlet fejl.", exception);

        try
        {
            var dialog = new FejlDialogWindow(exception, AppPaths.LogMappe);
            dialog.ShowDialog();
        }
        catch
        {
            System.Windows.MessageBox.Show(
                $"Der opstod en uventet fejl: {exception.Message}",
                "Filnavneværktøj - uventet fejl",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }
}
