using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class RenameServiceTests
{
    private static RenameService LavService(string historikMappe) =>
        new(new FileValidationService(), new HistoryService(historikMappe), new NoOpLogger());

    private static FileItem LavFileItem(string fuldSti)
    {
        var info = new FileInfo(fuldSti);
        return new FileItem
        {
            FullPath = info.FullName,
            FileName = info.Name,
            Extension = info.Extension,
            DirectoryPath = info.DirectoryName!,
            SizeBytes = 0,
            LastModifiedUtc = DateTime.UtcNow
        };
    }

    [Fact]
    public void GenererForhaandsvisning_BevarerFilendelseSomStandard()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("Tegning.dwg");
        var filer = new[] { LavFileItem(sti) };

        var regel = new RegexRenameRule { ErAktiveret = true, Moenster = @"\.dwg$", Erstatning = ".bak", Maal = RegexTarget.HeleFilnavnet };
        var konfiguration = new RenameConfiguration { Regler = new List<IRenameRule> { regel }, TilladAendringAfFilendelser = false };

        using var historikMappe = new TempTestFolder();
        var service = LavService(historikMappe.Sti);

        var forhaandsvisning = service.GenererForhaandsvisning(filer, konfiguration);

        Assert.Equal(".dwg", Path.GetExtension(forhaandsvisning[0].NytFilnavn));
    }

    [Fact]
    public void GenererForhaandsvisning_TilladAendringAfFilendelse_AendrerFilendelsen()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("Tegning.dwg");
        var filer = new[] { LavFileItem(sti) };

        var regel = new RegexRenameRule { ErAktiveret = true, Moenster = @"\.dwg$", Erstatning = ".bak", Maal = RegexTarget.HeleFilnavnet };
        var konfiguration = new RenameConfiguration { Regler = new List<IRenameRule> { regel }, TilladAendringAfFilendelser = true };

        using var historikMappe = new TempTestFolder();
        var service = LavService(historikMappe.Sti);

        var forhaandsvisning = service.GenererForhaandsvisning(filer, konfiguration);

        Assert.Equal(".bak", Path.GetExtension(forhaandsvisning[0].NytFilnavn));
    }

    [Fact]
    public async Task UdfoerAsync_NavnebytteMellemToFiler_LykkesForBegge()
    {
        using var mappe = new TempTestFolder();
        var stiA = mappe.OpretFil("A.txt");
        var stiB = mappe.OpretFil("B.txt");
        File.WriteAllText(stiA, "indhold-a");
        File.WriteAllText(stiB, "indhold-b");

        var itemA = new RenamePreviewItem { Kilde = LavFileItem(stiA), GammeltFilnavn = "A.txt", NytFilnavn = "B.txt", Mappe = mappe.Sti };
        var itemB = new RenamePreviewItem { Kilde = LavFileItem(stiB), GammeltFilnavn = "B.txt", NytFilnavn = "A.txt", Mappe = mappe.Sti };

        using var historikMappe = new TempTestFolder();
        var service = LavService(historikMappe.Sti);

        var operation = await service.UdfoerAsync(new[] { itemA, itemB }, mappe.Sti, ekstensionAendringTilladt: false);

        Assert.Equal(2, operation.AntalOmdoebt);
        Assert.Equal("indhold-a", File.ReadAllText(Path.Combine(mappe.Sti, "B.txt")));
        Assert.Equal("indhold-b", File.ReadAllText(Path.Combine(mappe.Sti, "A.txt")));
    }

    [Fact]
    public async Task UdfoerAsync_OpretterUndoDataDerKanBrugesTilAtFortryde()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("Original.txt");
        File.WriteAllText(sti, "vigtigt indhold");

        var item = new RenamePreviewItem { Kilde = LavFileItem(sti), GammeltFilnavn = "Original.txt", NytFilnavn = "NytNavn.txt", Mappe = mappe.Sti };

        using var historikMappe = new TempTestFolder();
        var service = LavService(historikMappe.Sti);
        var historyService = new HistoryService(historikMappe.Sti);

        var operation = await service.UdfoerAsync(new[] { item }, mappe.Sti, ekstensionAendringTilladt: false);

        Assert.Equal(1, operation.AntalOmdoebt);
        Assert.True(File.Exists(Path.Combine(mappe.Sti, "NytNavn.txt")));

        var gemtOperation = await historyService.HentAsync(operation.OperationId);
        Assert.NotNull(gemtOperation);
        Assert.Single(gemtOperation!.Entries);
        Assert.Equal(sti, gemtOperation.Entries[0].OprindeligFuldSti);

        var fortrydelse = await service.FortrydAsync(operation);

        Assert.Equal(1, fortrydelse.AntalOmdoebt);
        Assert.True(File.Exists(sti));
        Assert.Equal("vigtigt indhold", File.ReadAllText(sti));
        Assert.False(File.Exists(Path.Combine(mappe.Sti, "NytNavn.txt")));
    }

    [Fact]
    public async Task FortrydAsync_FilFjernetEfterOmdoebning_ViserFejlOgOverskriverIkkeAndet()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("Original.txt");

        var item = new RenamePreviewItem { Kilde = LavFileItem(sti), GammeltFilnavn = "Original.txt", NytFilnavn = "NytNavn.txt", Mappe = mappe.Sti };

        using var historikMappe = new TempTestFolder();
        var service = LavService(historikMappe.Sti);

        var operation = await service.UdfoerAsync(new[] { item }, mappe.Sti, ekstensionAendringTilladt: false);

        // Filen fjernes manuelt, som om brugeren havde slettet den efter omdøbningen.
        File.Delete(Path.Combine(mappe.Sti, "NytNavn.txt"));

        var fortrydelse = await service.FortrydAsync(operation);

        Assert.Equal(0, fortrydelse.AntalOmdoebt);
    }
}
