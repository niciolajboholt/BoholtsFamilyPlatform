using Filnavnevaerktoej.Core.Services;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class WindowsFileNameValidatorTests
{
    [Theory]
    [InlineData("fil<navn.txt")]
    [InlineData("fil>navn.txt")]
    [InlineData("fil:navn.txt")]
    [InlineData("fil\"navn.txt")]
    [InlineData("fil/navn.txt")]
    [InlineData("fil\\navn.txt")]
    [InlineData("fil|navn.txt")]
    [InlineData("fil?navn.txt")]
    [InlineData("fil*navn.txt")]
    public void ValiderFilnavn_UgyldigeWindowsTegn_GiverFejl(string filnavn)
    {
        var fejl = WindowsFileNameValidator.ValiderFilnavn(filnavn);
        Assert.NotNull(fejl);
    }

    [Theory]
    [InlineData("CON")]
    [InlineData("con.txt")]
    [InlineData("PRN")]
    [InlineData("AUX")]
    [InlineData("NUL")]
    [InlineData("COM1")]
    [InlineData("COM9.pdf")]
    [InlineData("LPT1")]
    [InlineData("LPT9.dwg")]
    public void ValiderFilnavn_ReserveredeWindowsNavne_GiverFejl(string filnavn)
    {
        var fejl = WindowsFileNameValidator.ValiderFilnavn(filnavn);
        Assert.NotNull(fejl);
    }

    [Fact]
    public void ValiderFilnavn_SlutterMedPunktum_GiverFejl()
    {
        Assert.NotNull(WindowsFileNameValidator.ValiderFilnavn("filnavn."));
    }

    [Fact]
    public void ValiderFilnavn_SlutterMedMellemrum_GiverFejl()
    {
        Assert.NotNull(WindowsFileNameValidator.ValiderFilnavn("filnavn "));
    }

    [Fact]
    public void ValiderFilnavn_TomtFilnavn_GiverFejl()
    {
        Assert.NotNull(WindowsFileNameValidator.ValiderFilnavn(""));
    }

    [Fact]
    public void ValiderFilnavn_GyldigtFilnavnMedDanskeTegnOgMellemrum_GiverIkkeFejl()
    {
        Assert.Null(WindowsFileNameValidator.ValiderFilnavn("Ærø Øst Aabenraa Tegning 01.dwg"));
    }

    [Fact]
    public void ValiderStiLaengde_MegetLangSti_GiverFejl()
    {
        var langtNavn = new string('a', 300) + ".txt";
        var fejl = WindowsFileNameValidator.ValiderStiLaengde(Path.Combine("C:\\Test", langtNavn));
        Assert.NotNull(fejl);
    }

    [Fact]
    public void ValiderStiLaengde_NormalSti_GiverIkkeFejl()
    {
        Assert.Null(WindowsFileNameValidator.ValiderStiLaengde(@"C:\Test\Tegning01.dwg"));
    }
}
