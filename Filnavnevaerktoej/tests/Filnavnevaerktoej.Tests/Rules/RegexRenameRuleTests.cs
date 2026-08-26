using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class RegexRenameRuleTests
{
    private static RenameRuleContext Kontekst() => new() { OriginalFileName = "x", OriginalExtension = "", Index = 0 };

    [Theory]
    [InlineData("FloorPlan-NB5_K01_H1_E0-Niveau0", "NB5_K01_H1_E0 - Niveau 0")]
    [InlineData("FloorPlan-NB5_K01_H1_E0-Niveau1", "NB5_K01_H1_E0 - Niveau 1")]
    [InlineData("FloorPlan-NB5_K02_H1_E0-Niveau2", "NB5_K02_H1_E0 - Niveau 2")]
    [InlineData("FloorPlan-NB5_K03_H2_E0-Niveau10", "NB5_K03_H2_E0 - Niveau 10")]
    public void Anvend_MedCaptureGroups_MatcherSpecifikationensEksempel(string navn, string forventet)
    {
        var regel = new RegexRenameRule
        {
            ErAktiveret = true,
            Moenster = @"^FloorPlan-(.+)-Niveau(\d+)$",
            Erstatning = "$1 - Niveau $2"
        };

        var resultat = regel.Anvend(new WorkingFileName(navn, ".dwg"), Kontekst());

        Assert.Equal(forventet, resultat.NameWithoutExtension);
        Assert.Equal(".dwg", resultat.Extension);
    }

    [Fact]
    public void ValiderMoenster_UgyldigRegex_ReturnererDanskFejlbesked()
    {
        var regel = new RegexRenameRule { ErAktiveret = true, Moenster = "[Ugyldig(" };

        var fejl = regel.ValiderMoenster();

        Assert.NotNull(fejl);
        Assert.Contains("ugyldigt", fejl, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Anvend_UgyldigRegex_KasterUgyldigRegexExceptionOgVælterIkkeProgrammet()
    {
        var regel = new RegexRenameRule { ErAktiveret = true, Moenster = "[Ugyldig(", Erstatning = "x" };

        Assert.Throws<UgyldigRegexException>(() => regel.Anvend(new WorkingFileName("Test", ".txt"), Kontekst()));
    }

    [Fact]
    public void Anvend_PaaHeleFilnavnet_KanAendreFilendelse()
    {
        var regel = new RegexRenameRule
        {
            ErAktiveret = true,
            Moenster = @"\.dwg$",
            Erstatning = ".bak",
            Maal = RegexTarget.HeleFilnavnet
        };

        var resultat = regel.Anvend(new WorkingFileName("Tegning01", ".dwg"), Kontekst());

        Assert.Equal("Tegning01", resultat.NameWithoutExtension);
        Assert.Equal(".bak", resultat.Extension);
    }

    [Fact]
    public void Anvend_KunFoersteMatch_ErstatterKunEnGang()
    {
        var regel = new RegexRenameRule { ErAktiveret = true, Moenster = "a", Erstatning = "_", KunFoersteMatch = true };

        var resultat = regel.Anvend(new WorkingFileName("banana", ""), Kontekst());

        Assert.Equal("b_nana", resultat.NameWithoutExtension);
    }
}
