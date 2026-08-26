using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IFileDiscoveryService
{
    /// <summary>Validerer en mappesti. Returnerer en dansk fejlbesked, eller null hvis stien er gyldig og tilgængelig.</summary>
    string? ValiderMappe(string? mappeSti);

    Task<IReadOnlyList<FileItem>> FindFilerAsync(FileDiscoveryOptions options, CancellationToken cancellationToken = default);
}
