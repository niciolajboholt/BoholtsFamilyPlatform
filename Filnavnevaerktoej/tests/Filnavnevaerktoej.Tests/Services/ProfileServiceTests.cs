using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class ProfileServiceTests
{
    [Fact]
    public async Task GemOgHentProfil_Roundtrip_BevarerReglerPolymorft()
    {
        using var mappe = new TempTestFolder();
        var service = new ProfileService(mappe.Sti);

        var profil = new RenameProfile
        {
            Navn = "NB5 Tegninger",
            FilFilter = "*.dwg;*.pdf",
            MedtagUndermapper = true,
            TilladAendringAfFilendelser = false,
            Regler = new List<IRenameRule>
            {
                new DeleteTextRule { ErAktiveret = true, TekstDerSkalSlettes = "FloorPlan-" },
                new RegexRenameRule
                {
                    ErAktiveret = true,
                    Moenster = @"^(.+)-Niveau(\d+)$",
                    Erstatning = "$1 - Niveau $2",
                    Maal = RegexTarget.NavnUdenFilendelse
                },
                new NumberingRule { ErAktiveret = true, Startnummer = 1, AntalCifre = 3 }
            }
        };

        await service.GemProfilAsync(profil);
        var hentet = await service.HentProfilAsync("NB5 Tegninger");

        Assert.NotNull(hentet);
        Assert.Equal(profil.FilFilter, hentet!.FilFilter);
        Assert.True(hentet.MedtagUndermapper);
        Assert.Equal(3, hentet.Regler.Count);

        var sletRegel = Assert.IsType<DeleteTextRule>(hentet.Regler[0]);
        Assert.Equal("FloorPlan-", sletRegel.TekstDerSkalSlettes);

        var regexRegel = Assert.IsType<RegexRenameRule>(hentet.Regler[1]);
        Assert.Equal(@"^(.+)-Niveau(\d+)$", regexRegel.Moenster);
        Assert.Equal("$1 - Niveau $2", regexRegel.Erstatning);

        var nummereringRegel = Assert.IsType<NumberingRule>(hentet.Regler[2]);
        Assert.Equal(3, nummereringRegel.AntalCifre);
    }

    [Fact]
    public async Task HentAlleProfilerAsync_ReturnererAlleGemteProfilerSorteretEfterNavn()
    {
        using var mappe = new TempTestFolder();
        var service = new ProfileService(mappe.Sti);

        await service.GemProfilAsync(new RenameProfile { Navn = "AFRY IFC" });
        await service.GemProfilAsync(new RenameProfile { Navn = "Standard tegningsnavne" });
        await service.GemProfilAsync(new RenameProfile { Navn = "NIRAS PDF" });

        var profiler = await service.HentAlleProfilerAsync();

        Assert.Equal(3, profiler.Count);
        Assert.Equal("AFRY IFC", profiler[0].Navn);
    }

    [Fact]
    public async Task SletProfilAsync_FjernerProfilenPermanent()
    {
        using var mappe = new TempTestFolder();
        var service = new ProfileService(mappe.Sti);

        await service.GemProfilAsync(new RenameProfile { Navn = "Skal slettes" });
        await service.SletProfilAsync("Skal slettes");

        var hentet = await service.HentProfilAsync("Skal slettes");

        Assert.Null(hentet);
    }
}
