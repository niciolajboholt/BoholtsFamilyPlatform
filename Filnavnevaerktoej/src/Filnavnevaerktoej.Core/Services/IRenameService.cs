using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

public interface IRenameService
{
    /// <summary>Bygger en levende forhåndsvisning ved at anvende regelsættet på hver fil. Kaster aldrig ved ugyldig regex.</summary>
    IReadOnlyList<RenamePreviewItem> GenererForhaandsvisning(IReadOnlyList<FileItem> filer, RenameConfiguration konfiguration);

    /// <summary>
    /// Udfører den faktiske omdøbning af de valgte, gyldige ændringer. Kontrollerer filsystemet igen
    /// og afbryder sikkert uden at ændre noget, hvis der er opstået nye konflikter siden forhåndsvisningen.
    /// </summary>
    Task<RenameOperation> UdfoerAsync(
        IReadOnlyList<RenamePreviewItem> valgteAendringer,
        string kildeMappe,
        bool ekstensionAendringTilladt,
        IProgress<RenameFremdrift>? fremdrift = null,
        CancellationToken cancellationToken = default);

    /// <summary>Bygger en forhåndsvisning af hvad en fortrydelse af en tidligere operation vil gøre.</summary>
    IReadOnlyList<RenamePreviewItem> GenererFortrydelsesForhaandsvisning(RenameOperation tidligereOperation);

    /// <summary>Fortryder en tidligere gennemført operation. Kun filer der blev omdøbt med succes indgår.</summary>
    Task<RenameOperation> FortrydAsync(
        RenameOperation tidligereOperation,
        IProgress<RenameFremdrift>? fremdrift = null,
        CancellationToken cancellationToken = default);
}
