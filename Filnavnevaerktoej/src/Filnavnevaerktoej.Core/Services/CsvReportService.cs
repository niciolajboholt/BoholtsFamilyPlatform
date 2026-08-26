using System.Globalization;
using System.Text;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Services;

/// <summary>
/// Gemmer en omdøbningsrapport som CSV. Bruger semikolon som skilletegn og UTF-8 med BOM,
/// så filen åbner korrekt med danske tegn og kolonneopdeling i dansk Excel.
/// </summary>
public sealed class CsvReportService : IReportService
{
    private const char Skilletegn = ';';
    private static readonly CultureInfo DanskKultur = CultureInfo.GetCultureInfo("da-DK");

    public async Task GemCsvRapportAsync(RenameOperation operation, string filSti, CancellationToken cancellationToken = default)
    {
        var linjer = new List<string>
        {
            LavLinje("Dato og tidspunkt", "Oprindelig sti", "Gammelt filnavn", "Nyt filnavn", "Filtype", "Resultat", "Eventuel fejlbesked")
        };

        foreach (var entry in operation.Entries)
        {
            linjer.Add(LavLinje(
                operation.TidspunktUtc.ToLocalTime().ToString("dd-MM-yyyy HH:mm:ss", DanskKultur),
                entry.OprindeligFuldSti,
                entry.OprindeligtFilnavn,
                entry.NytFilnavn,
                entry.Filtype,
                OversaetResultat(entry.Resultat),
                entry.Fejlbesked ?? string.Empty));
        }

        var indhold = string.Join(Environment.NewLine, linjer);
        var utf8MedBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        await File.WriteAllTextAsync(filSti, indhold, utf8MedBom, cancellationToken).ConfigureAwait(false);
    }

    private static string OversaetResultat(RenameEntryResult resultat) => resultat switch
    {
        RenameEntryResult.Succes => "Succes",
        RenameEntryResult.Fejlet => "Fejlet",
        RenameEntryResult.Sprunget_Over => "Sprunget over",
        _ => "Ikke udført"
    };

    private static string LavLinje(params string[] felter) =>
        string.Join(Skilletegn, felter.Select(EscapeFelt));

    private static string EscapeFelt(string felt)
    {
        if (felt.IndexOfAny(new[] { Skilletegn, '"', '\r', '\n' }) < 0)
            return felt;

        return "\"" + felt.Replace("\"", "\"\"") + "\"";
    }
}
