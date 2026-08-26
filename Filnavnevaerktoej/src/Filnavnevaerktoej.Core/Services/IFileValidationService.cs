using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IFileValidationService
{
    /// <summary>
    /// Validerer en samlet forhåndsvisning og opdaterer Status og Bemaerkning på hvert element.
    /// Konflikter vurderes pr. mappe. Sæt <paramref name="tjekLaasteFiler"/> til false for at springe
    /// den langsommere kontrol af låste/åbne filer over (bruges typisk under live-forhåndsvisning).
    /// </summary>
    void Valider(IReadOnlyList<RenamePreviewItem> items, bool ekstensionAendringTilladt, bool tjekLaasteFiler = false);
}
