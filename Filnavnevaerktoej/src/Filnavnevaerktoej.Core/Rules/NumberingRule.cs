using System.Globalization;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Tilføjer fortløbende nummerering til filnavnet (uden filendelse), baseret på filens position i batchen.</summary>
public sealed class NumberingRule : RenameRuleBase
{
    private int _startnummer = 1;
    private int _trin = 1;
    private int _antalCifre = 3;
    private NumberingPlacement _placering = NumberingPlacement.Start;
    private string _tekstFoerNummer = string.Empty;
    private string _tekstEfterNummer = "_";

    public override string Navn => "Nummerering";

    public int Startnummer
    {
        get => _startnummer;
        set => SetField(ref _startnummer, value);
    }

    public int Trin
    {
        get => _trin;
        set => SetField(ref _trin, value);
    }

    public int AntalCifre
    {
        get => _antalCifre;
        set => SetField(ref _antalCifre, value);
    }

    public NumberingPlacement Placering
    {
        get => _placering;
        set => SetField(ref _placering, value);
    }

    public string TekstFoerNummer
    {
        get => _tekstFoerNummer;
        set => SetField(ref _tekstFoerNummer, value ?? string.Empty);
    }

    public string TekstEfterNummer
    {
        get => _tekstEfterNummer;
        set => SetField(ref _tekstEfterNummer, value ?? string.Empty);
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret)
            return input;

        var nummer = Startnummer + context.Index * Trin;
        var cifre = Math.Max(1, AntalCifre);
        var nummerTekst = nummer.ToString(CultureInfo.InvariantCulture).PadLeft(cifre, '0');
        if (nummer < 0)
        {
            // Negative tal: bevar fortegn, men zero-pad selve tal-delen.
            var absolut = Math.Abs(nummer).ToString(CultureInfo.InvariantCulture).PadLeft(cifre, '0');
            nummerTekst = "-" + absolut;
        }

        var segment = TekstFoerNummer + nummerTekst + TekstEfterNummer;
        var navn = input.NameWithoutExtension;

        var nytNavn = Placering switch
        {
            NumberingPlacement.Start => segment + navn,
            NumberingPlacement.Slutning => navn + segment,
            _ => navn
        };

        return input with { NameWithoutExtension = nytNavn };
    }
}
