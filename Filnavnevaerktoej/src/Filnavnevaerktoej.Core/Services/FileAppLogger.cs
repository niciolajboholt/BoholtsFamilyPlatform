using System.Globalization;

namespace Filnavnevaerktoej.Core.Services;

/// <summary>
/// Simpel, trådsikker fil-logger. Skriver aldrig filers indhold - kun stier, tal og statusbeskeder.
/// </summary>
public sealed class FileAppLogger : IAppLogger
{
    private readonly object _laas = new();
    private readonly string _logFil;

    public FileAppLogger()
    {
        AppPaths.SikrMapperFindes();
        _logFil = Path.Combine(AppPaths.LogMappe, $"filnavnevaerktoej-{DateTime.Now:yyyy-MM-dd}.fnv-log");
    }

    public void Info(string besked) => Skriv("INFO", besked);
    public void Advarsel(string besked) => Skriv("ADVARSEL", besked);

    public void Fejl(string besked, Exception? exception = null)
    {
        var fuldBesked = exception is null ? besked : $"{besked} | Undtagelse: {exception.GetType().Name}: {exception.Message}";
        Skriv("FEJL", fuldBesked);
    }

    private void Skriv(string niveau, string besked)
    {
        var linje = $"{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)} [{niveau}] {besked}";
        lock (_laas)
        {
            try
            {
                File.AppendAllLines(_logFil, new[] { linje });
            }
            catch
            {
                // Logning må aldrig vælte programmet.
            }
        }
    }
}
