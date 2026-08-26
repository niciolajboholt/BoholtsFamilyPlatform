using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;

namespace Filnavnevaerktoej.Core.Services;

public sealed class RenameService : IRenameService
{
    private readonly IFileValidationService _validation;
    private readonly IHistoryService _history;
    private readonly IAppLogger _logger;

    public RenameService(IFileValidationService validation, IHistoryService history, IAppLogger logger)
    {
        _validation = validation;
        _history = history;
        _logger = logger;
    }

    public IReadOnlyList<RenamePreviewItem> GenererForhaandsvisning(IReadOnlyList<FileItem> filer, RenameConfiguration konfiguration)
    {
        var items = new List<RenamePreviewItem>(filer.Count);

        for (var i = 0; i < filer.Count; i++)
        {
            var fil = filer[i];
            var arbejdsNavn = WorkingFileName.FromFileItem(fil);
            var context = new RenameRuleContext
            {
                OriginalFileName = fil.FileName,
                OriginalExtension = fil.Extension,
                Index = i
            };

            foreach (var regel in konfiguration.Regler.Where(r => r.ErAktiveret))
            {
                try
                {
                    arbejdsNavn = regel.Anvend(arbejdsNavn, context);
                }
                catch (UgyldigRegexException)
                {
                    // Ugyldig regex må aldrig vælte forhåndsvisningen - reglen springes blot over for nu.
                    // ViewModel'en er ansvarlig for at vise selve regex-fejlen til brugeren.
                }
            }

            var endeligExtension = konfiguration.TilladAendringAfFilendelser ? arbejdsNavn.Extension : fil.Extension;
            var nytFilnavn = arbejdsNavn.NameWithoutExtension + endeligExtension;

            items.Add(new RenamePreviewItem
            {
                Kilde = fil,
                GammeltFilnavn = fil.FileName,
                NytFilnavn = nytFilnavn,
                Mappe = fil.DirectoryPath
            });
        }

        _validation.Valider(items, konfiguration.TilladAendringAfFilendelser, tjekLaasteFiler: false);
        return items;
    }

    public async Task<RenameOperation> UdfoerAsync(
        IReadOnlyList<RenamePreviewItem> valgteAendringer,
        string kildeMappe,
        bool ekstensionAendringTilladt,
        IProgress<RenameFremdrift>? fremdrift = null,
        CancellationToken cancellationToken = default)
    {
        _logger.Info($"Starter omdøbning af {valgteAendringer.Count} fil(er) i '{kildeMappe}'.");

        var friskeItems = GenopbygFraDisk(valgteAendringer);
        _validation.Valider(friskeItems, ekstensionAendringTilladt, tjekLaasteFiler: true);

        var blokerendeFejl = friskeItems.Where(i => i.Status == RenameStatus.Fejl).ToList();
        if (blokerendeFejl.Count > 0)
        {
            _logger.Fejl($"Omdøbning afbrudt: {blokerendeFejl.Count} fil(er) har nye konflikter siden forhåndsvisningen.");

            var afbrudteEntries = friskeItems.Select(i => new RenameOperationEntry
            {
                OprindeligFuldSti = i.GammelFuldSti,
                NyFuldSti = i.NyFuldSti,
                Resultat = RenameEntryResult.Fejlet,
                Fejlbesked = i.Status == RenameStatus.Fejl
                    ? $"Afbrudt før omdøbning: {i.Bemaerkning}"
                    : "Afbrudt fordi andre filer i samme handling havde en konflikt."
            }).ToList();

            var afbrudtOperation = new RenameOperation
            {
                OperationId = Guid.NewGuid().ToString("N"),
                TidspunktUtc = DateTime.UtcNow,
                KildeMappe = kildeMappe,
                Entries = afbrudteEntries
            };

            await _history.GemAsync(afbrudtOperation, cancellationToken).ConfigureAwait(false);
            return afbrudtOperation;
        }

        var par = friskeItems
            .Where(i => i.AendresRentFaktisk)
            .Select(i => (Gammel: i.GammelFuldSti, Ny: i.NyFuldSti))
            .ToList();

        var entries = await ExecuteToTrinsOmdoebningAsync(par, fremdrift, cancellationToken).ConfigureAwait(false);

        var operation = new RenameOperation
        {
            OperationId = Guid.NewGuid().ToString("N"),
            TidspunktUtc = DateTime.UtcNow,
            KildeMappe = kildeMappe,
            Entries = entries
        };

        await _history.GemAsync(operation, cancellationToken).ConfigureAwait(false);
        _logger.Info($"Omdøbning afsluttet: {operation.AntalOmdoebt} succes, {operation.AntalFejlet} fejl.");
        return operation;
    }

    public IReadOnlyList<RenamePreviewItem> GenererFortrydelsesForhaandsvisning(RenameOperation tidligereOperation)
    {
        var items = new List<RenamePreviewItem>();

        foreach (var entry in tidligereOperation.Entries.Where(e => e.Resultat == RenameEntryResult.Succes))
        {
            var mappe = Path.GetDirectoryName(entry.NyFuldSti) ?? tidligereOperation.KildeMappe;
            FileItem kilde;

            try
            {
                var info = new FileInfo(entry.NyFuldSti);
                if (!info.Exists)
                {
                    items.Add(LavFejlPreview(entry, mappe, "Filen findes ikke længere og kan ikke fortrydes."));
                    continue;
                }

                kilde = new FileItem
                {
                    FullPath = info.FullName,
                    FileName = info.Name,
                    Extension = info.Extension,
                    DirectoryPath = info.DirectoryName ?? mappe,
                    SizeBytes = info.Length,
                    LastModifiedUtc = info.LastWriteTimeUtc,
                    IsHidden = info.Attributes.HasFlag(FileAttributes.Hidden),
                    IsSystem = info.Attributes.HasFlag(FileAttributes.System),
                    IsReadOnly = info.IsReadOnly
                };
            }
            catch (Exception)
            {
                items.Add(LavFejlPreview(entry, mappe, "Filen kunne ikke læses."));
                continue;
            }

            items.Add(new RenamePreviewItem
            {
                Kilde = kilde,
                GammeltFilnavn = entry.NytFilnavn,
                NytFilnavn = entry.OprindeligtFilnavn,
                Mappe = mappe
            });
        }

        _validation.Valider(items, ekstensionAendringTilladt: true, tjekLaasteFiler: false);
        return items;
    }

    public async Task<RenameOperation> FortrydAsync(
        RenameOperation tidligereOperation,
        IProgress<RenameFremdrift>? fremdrift = null,
        CancellationToken cancellationToken = default)
    {
        _logger.Info($"Starter fortrydelse af operation {tidligereOperation.OperationId}.");

        var forhaandsvisning = GenererFortrydelsesForhaandsvisning(tidligereOperation);
        var blokerendeFejl = forhaandsvisning.Where(i => i.Status == RenameStatus.Fejl).ToList();

        List<RenameOperationEntry> entries;
        if (blokerendeFejl.Count > 0)
        {
            _logger.Fejl($"Fortrydelse afbrudt: {blokerendeFejl.Count} fil(er) har konflikter.");
            entries = forhaandsvisning.Select(i => new RenameOperationEntry
            {
                OprindeligFuldSti = i.GammelFuldSti,
                NyFuldSti = i.NyFuldSti,
                Resultat = i.Status == RenameStatus.Fejl ? RenameEntryResult.Fejlet : RenameEntryResult.Sprunget_Over,
                Fejlbesked = i.Status == RenameStatus.Fejl ? i.Bemaerkning : "Sprunget over pga. konflikt for andre filer."
            }).ToList();
        }
        else
        {
            var par = forhaandsvisning
                .Where(i => i.AendresRentFaktisk)
                .Select(i => (Gammel: i.GammelFuldSti, Ny: i.NyFuldSti))
                .ToList();

            entries = await ExecuteToTrinsOmdoebningAsync(par, fremdrift, cancellationToken).ConfigureAwait(false);
        }

        tidligereOperation.ErFortrudt = entries.Count > 0 && entries.All(e => e.Resultat == RenameEntryResult.Succes);
        await _history.GemAsync(tidligereOperation, cancellationToken).ConfigureAwait(false);

        var fortrydelsesOperation = new RenameOperation
        {
            OperationId = Guid.NewGuid().ToString("N"),
            TidspunktUtc = DateTime.UtcNow,
            KildeMappe = tidligereOperation.KildeMappe,
            Entries = entries
        };

        await _history.GemAsync(fortrydelsesOperation, cancellationToken).ConfigureAwait(false);
        _logger.Info($"Fortrydelse afsluttet: {fortrydelsesOperation.AntalOmdoebt} succes, {fortrydelsesOperation.AntalFejlet} fejl.");
        return fortrydelsesOperation;
    }

    private static RenamePreviewItem LavFejlPreview(RenameOperationEntry entry, string mappe, string besked)
    {
        var pladsholder = new FileItem
        {
            FullPath = entry.NyFuldSti,
            FileName = entry.NytFilnavn,
            Extension = Path.GetExtension(entry.NytFilnavn),
            DirectoryPath = mappe,
            SizeBytes = 0,
            LastModifiedUtc = DateTime.MinValue
        };

        return new RenamePreviewItem
        {
            Kilde = pladsholder,
            GammeltFilnavn = entry.NytFilnavn,
            NytFilnavn = entry.OprindeligtFilnavn,
            Mappe = mappe,
            Status = RenameStatus.Fejl,
            Bemaerkning = besked
        };
    }

    private static List<RenamePreviewItem> GenopbygFraDisk(IReadOnlyList<RenamePreviewItem> items)
    {
        var resultat = new List<RenamePreviewItem>(items.Count);

        foreach (var item in items)
        {
            try
            {
                var info = new FileInfo(item.GammelFuldSti);
                if (!info.Exists)
                {
                    resultat.Add(new RenamePreviewItem
                    {
                        Kilde = item.Kilde,
                        GammeltFilnavn = item.GammeltFilnavn,
                        NytFilnavn = item.NytFilnavn,
                        Mappe = item.Mappe,
                        Status = RenameStatus.Fejl,
                        Bemaerkning = "Filen findes ikke længere - den er muligvis flyttet eller slettet."
                    });
                    continue;
                }

                resultat.Add(new RenamePreviewItem
                {
                    Kilde = item.Kilde,
                    GammeltFilnavn = item.GammeltFilnavn,
                    NytFilnavn = item.NytFilnavn,
                    Mappe = item.Mappe
                });
            }
            catch (Exception)
            {
                resultat.Add(new RenamePreviewItem
                {
                    Kilde = item.Kilde,
                    GammeltFilnavn = item.GammeltFilnavn,
                    NytFilnavn = item.NytFilnavn,
                    Mappe = item.Mappe,
                    Status = RenameStatus.Fejl,
                    Bemaerkning = "Filen kunne ikke læses."
                });
            }
        }

        return resultat;
    }

    /// <summary>
    /// Udfører en sikker to-trins-omdøbning: alle filer flyttes først til unikke midlertidige navne
    /// i samme mappe, og derefter til deres endelige navne. Dette gør navnebytte (A↔B) sikkert og
    /// undgår, at en fil ved et uheld overskriver en anden undervejs.
    /// </summary>
    private async Task<List<RenameOperationEntry>> ExecuteToTrinsOmdoebningAsync(
        List<(string Gammel, string Ny)> par,
        IProgress<RenameFremdrift>? fremdrift,
        CancellationToken cancellationToken)
    {
        var entries = par.Select(p => new RenameOperationEntry { OprindeligFuldSti = p.Gammel, NyFuldSti = p.Ny }).ToList();
        if (entries.Count == 0)
            return entries;

        var midlertidigeStier = new Dictionary<int, string>();

        // --- Fase 1: omdøb til unikke midlertidige navne ---
        for (var i = 0; i < entries.Count; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var entry = entries[i];
            var mappe = Path.GetDirectoryName(entry.OprindeligFuldSti) ?? string.Empty;
            var midlertidigSti = Path.Combine(mappe, $".fnv-tmp-{Guid.NewGuid():N}.tmp");

            try
            {
                File.Move(entry.OprindeligFuldSti, midlertidigSti);
                midlertidigeStier[i] = midlertidigSti;
                fremdrift?.Report(new RenameFremdrift(i + 1, entries.Count * 2, $"Forbereder: {Path.GetFileName(entry.OprindeligFuldSti)}"));
            }
            catch (Exception ex)
            {
                _logger.Fejl($"Fase 1 fejlede for '{entry.OprindeligFuldSti}', ruller tilbage.", ex);

                // Rul alle tidligere gennemførte fase 1-flytninger tilbage.
                foreach (var (index, tempSti) in midlertidigeStier)
                {
                    try
                    {
                        File.Move(tempSti, entries[index].OprindeligFuldSti);
                    }
                    catch (Exception rollbackEx)
                    {
                        _logger.Fejl($"Rollback fejlede for '{tempSti}'.", rollbackEx);
                    }
                }

                foreach (var e in entries)
                {
                    e.Resultat = RenameEntryResult.Fejlet;
                    e.Fejlbesked = ReferenceEquals(e, entry)
                        ? $"Kunne ikke forberede omdøbning: {ex.Message}"
                        : "Afbrudt pga. fejl på en anden fil i samme handling (sikker rollback gennemført).";
                }

                return entries;
            }
        }

        // --- Fase 2: omdøb fra midlertidige navne til de endelige navne ---
        for (var i = 0; i < entries.Count; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var entry = entries[i];
            var midlertidigSti = midlertidigeStier[i];

            try
            {
                File.Move(midlertidigSti, entry.NyFuldSti);
                entry.Resultat = RenameEntryResult.Succes;
                _logger.Info($"Omdøbt: '{Path.GetFileName(entry.OprindeligFuldSti)}' -> '{entry.NytFilnavn}'.");
            }
            catch (Exception ex)
            {
                _logger.Fejl($"Fase 2 fejlede for '{entry.NyFuldSti}', forsøger at gendanne oprindeligt navn.", ex);
                entry.Resultat = RenameEntryResult.Fejlet;
                entry.Fejlbesked = ex.Message;

                try
                {
                    File.Move(midlertidigSti, entry.OprindeligFuldSti);
                }
                catch (Exception rollbackEx)
                {
                    _logger.Fejl($"Kunne ikke gendanne oprindeligt navn for '{midlertidigSti}'.", rollbackEx);
                    entry.Fejlbesked += " Filen ligger midlertidigt under et internt reservenavn i samme mappe - kontakt support.";
                }
            }

            fremdrift?.Report(new RenameFremdrift(entries.Count + i + 1, entries.Count * 2, $"Omdøber: {entry.NytFilnavn}"));
            await Task.Yield();
        }

        return entries;
    }
}
