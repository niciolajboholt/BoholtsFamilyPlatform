using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class FileValidationServiceTests
{
    private readonly FileValidationService _service = new();

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

    private static RenamePreviewItem LavPreview(string gammelFuldSti, string nytFilnavn)
    {
        var kilde = LavFileItem(gammelFuldSti);
        return new RenamePreviewItem
        {
            Kilde = kilde,
            GammeltFilnavn = kilde.FileName,
            NytFilnavn = nytFilnavn,
            Mappe = kilde.DirectoryPath
        };
    }

    [Fact]
    public void Valider_SammeFilnavnUdenAendring_ErUaendret()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("a.txt");
        var items = new[] { LavPreview(sti, "a.txt") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.Equal(RenameStatus.Uaendret, items[0].Status);
    }

    [Fact]
    public void Valider_UgyldigtFilnavn_GiverFejlstatus()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("a.txt");
        var items = new[] { LavPreview(sti, "b<c.txt") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.Equal(RenameStatus.Fejl, items[0].Status);
    }

    [Fact]
    public void Valider_DubletteNyeFilnavne_GiverFejlForBegge()
    {
        using var mappe = new TempTestFolder();
        var stiA = mappe.OpretFil("a.txt");
        var stiB = mappe.OpretFil("b.txt");
        var items = new[] { LavPreview(stiA, "samme.txt"), LavPreview(stiB, "samme.txt") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.All(items, i => Assert.Equal(RenameStatus.Fejl, i.Status));
    }

    [Fact]
    public void Valider_KonfliktMedEksisterendeFil_GiverFejl()
    {
        using var mappe = new TempTestFolder();
        var stiA = mappe.OpretFil("a.txt");
        mappe.OpretFil("findes-allerede.txt");
        var items = new[] { LavPreview(stiA, "findes-allerede.txt") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.Equal(RenameStatus.Fejl, items[0].Status);
    }

    [Fact]
    public void Valider_NavnebytteMellemToFiler_ErGyldigtOgIkkeEnKonflikt()
    {
        using var mappe = new TempTestFolder();
        var stiA = mappe.OpretFil("A.txt");
        var stiB = mappe.OpretFil("B.txt");
        var items = new[] { LavPreview(stiA, "B.txt"), LavPreview(stiB, "A.txt") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.All(items, i => Assert.Equal(RenameStatus.AendresGyldigt, i.Status));
    }

    [Fact]
    public void Valider_MegetLangtFilnavn_GiverFejl()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("a.txt");
        var langtNavn = new string('x', 300) + ".txt";
        var items = new[] { LavPreview(sti, langtNavn) };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.Equal(RenameStatus.Fejl, items[0].Status);
    }

    [Fact]
    public void Valider_AendringAfFilendelseUdenTilladelse_GiverFejl()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("a.txt");
        var items = new[] { LavPreview(sti, "a.bak") };

        _service.Valider(items, ekstensionAendringTilladt: false);

        Assert.Equal(RenameStatus.Fejl, items[0].Status);
    }

    [Fact]
    public void Valider_AendringAfFilendelseMedTilladelse_GiverAdvarsel()
    {
        using var mappe = new TempTestFolder();
        var sti = mappe.OpretFil("a.txt");
        var items = new[] { LavPreview(sti, "a.bak") };

        _service.Valider(items, ekstensionAendringTilladt: true);

        Assert.Equal(RenameStatus.Advarsel, items[0].Status);
    }
}
