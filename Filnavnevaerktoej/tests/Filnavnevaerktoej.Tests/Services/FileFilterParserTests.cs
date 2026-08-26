using Filnavnevaerktoej.Core.Services;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class FileFilterParserTests
{
    [Fact]
    public void Parse_AlleFiler_GiverTomListe()
    {
        Assert.Empty(FileFilterParser.Parse("*.*"));
        Assert.Empty(FileFilterParser.Parse(""));
        Assert.Empty(FileFilterParser.Parse(null));
    }

    [Theory]
    [InlineData("*.dwg")]
    [InlineData("dwg")]
    [InlineData(".dwg")]
    public void Parse_EenFiltype_NormalisererTilPunktumOgEndelse(string raw)
    {
        var resultat = FileFilterParser.Parse(raw);

        Assert.Single(resultat);
        Assert.Equal(".dwg", resultat[0]);
    }

    [Fact]
    public void MatchesFilter_EenFiltype_MatcherKunDenneFiltype()
    {
        var filtre = FileFilterParser.Parse("*.dwg");

        Assert.True(FileFilterParser.MatchesFilter("Tegning.dwg", filtre));
        Assert.False(FileFilterParser.MatchesFilter("Tegning.pdf", filtre));
    }

    [Theory]
    [InlineData("*.dwg;*.pdf;*.ifc")]
    [InlineData("dwg,pdf,ifc")]
    [InlineData("*.dwg, *.pdf, *.ifc")]
    public void Parse_FlereFiltyper_GiverAlleTreEndelser(string raw)
    {
        var resultat = FileFilterParser.Parse(raw);

        Assert.Equal(3, resultat.Count);
        Assert.Contains(".dwg", resultat, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(".pdf", resultat, StringComparer.OrdinalIgnoreCase);
        Assert.Contains(".ifc", resultat, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public void MatchesFilter_FlereFiltyper_MatcherAlleAngivne()
    {
        var filtre = FileFilterParser.Parse("*.docx;*.xlsx");

        Assert.True(FileFilterParser.MatchesFilter("Rapport.docx", filtre));
        Assert.True(FileFilterParser.MatchesFilter("Budget.xlsx", filtre));
        Assert.False(FileFilterParser.MatchesFilter("Billede.png", filtre));
    }
}
