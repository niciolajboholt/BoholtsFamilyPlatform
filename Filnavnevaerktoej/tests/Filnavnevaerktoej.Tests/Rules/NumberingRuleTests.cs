using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Rules;
using Xunit;

namespace Filnavnevaerktoej.Tests.Rules;

public class NumberingRuleTests
{
    private static RenameRuleContext Kontekst(int index) => new() { OriginalFileName = "x", OriginalExtension = "", Index = index };

    [Theory]
    [InlineData(0, "001_Filnavn")]
    [InlineData(1, "002_Filnavn")]
    [InlineData(2, "003_Filnavn")]
    public void Anvend_MatcherSpecifikationensEksempel(int index, string forventet)
    {
        var regel = new NumberingRule
        {
            ErAktiveret = true,
            Startnummer = 1,
            Trin = 1,
            AntalCifre = 3,
            Placering = NumberingPlacement.Start,
            TekstEfterNummer = "_"
        };

        var resultat = regel.Anvend(new WorkingFileName("Filnavn", ".pdf"), Kontekst(index));

        Assert.Equal(forventet, resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_PlaceringSlutning()
    {
        var regel = new NumberingRule
        {
            ErAktiveret = true,
            Startnummer = 10,
            Trin = 5,
            AntalCifre = 2,
            Placering = NumberingPlacement.Slutning,
            TekstFoerNummer = "_",
            TekstEfterNummer = ""
        };

        var resultat = regel.Anvend(new WorkingFileName("Billede", ".jpg"), Kontekst(1));

        // Startnummer 10 + (index 1 * trin 5) = 15
        Assert.Equal("Billede_15", resultat.NameWithoutExtension);
    }

    [Fact]
    public void Anvend_AntalCifreStoerreEndTalletPadderMedNuller()
    {
        var regel = new NumberingRule { ErAktiveret = true, Startnummer = 7, AntalCifre = 4, TekstEfterNummer = "" };

        var resultat = regel.Anvend(new WorkingFileName("Fil", ""), Kontekst(0));

        Assert.Equal("0007Fil", resultat.NameWithoutExtension);
    }
}
