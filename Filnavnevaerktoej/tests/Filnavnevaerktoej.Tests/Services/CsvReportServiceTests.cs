using System.Text;
using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class CsvReportServiceTests
{
    [Fact]
    public async Task GemCsvRapportAsync_BrugerSemikolonOgUtf8Bom()
    {
        using var mappe = new TempTestFolder();
        var csvSti = Path.Combine(mappe.Sti, "rapport.csv");

        var operation = new RenameOperation
        {
            OperationId = "op1",
            TidspunktUtc = DateTime.UtcNow,
            KildeMappe = mappe.Sti,
            Entries = new List<RenameOperationEntry>
            {
                new()
                {
                    OprindeligFuldSti = Path.Combine(mappe.Sti, "Ærø.dwg"),
                    NyFuldSti = Path.Combine(mappe.Sti, "Aeroe.dwg"),
                    Resultat = RenameEntryResult.Succes
                }
            }
        };

        var service = new CsvReportService();
        await service.GemCsvRapportAsync(operation, csvSti);

        var raaBytes = await File.ReadAllBytesAsync(csvSti);
        Assert.True(raaBytes.Length > 3);
        Assert.Equal(0xEF, raaBytes[0]);
        Assert.Equal(0xBB, raaBytes[1]);
        Assert.Equal(0xBF, raaBytes[2]);

        var tekst = Encoding.UTF8.GetString(raaBytes);
        Assert.Contains("Dato og tidspunkt;Oprindelig sti;Gammelt filnavn;Nyt filnavn;Filtype;Resultat;Eventuel fejlbesked", tekst);
        Assert.Contains("Aeroe.dwg", tekst);
        Assert.Contains("Succes", tekst);
    }
}
