using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IProfileService
{
    Task GemProfilAsync(RenameProfile profil, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RenameProfile>> HentAlleProfilerAsync(CancellationToken cancellationToken = default);
    Task<RenameProfile?> HentProfilAsync(string navn, CancellationToken cancellationToken = default);
    Task SletProfilAsync(string navn, CancellationToken cancellationToken = default);
}
