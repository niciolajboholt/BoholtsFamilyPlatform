using Filnavnevaerktoej.Core.Services;

namespace Filnavnevaerktoej.Tests.TestSupport;

/// <summary>Logger der ikke skriver noget - bruges i tests, så de aldrig rører brugerens rigtige logmappe.</summary>
public sealed class NoOpLogger : IAppLogger
{
    public void Info(string besked) { }
    public void Advarsel(string besked) { }
    public void Fejl(string besked, Exception? exception = null) { }
}
