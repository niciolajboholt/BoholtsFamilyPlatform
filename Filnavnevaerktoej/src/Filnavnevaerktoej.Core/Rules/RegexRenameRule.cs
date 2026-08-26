using System.Text.RegularExpressions;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.Core.Rules;

/// <summary>Undtagelse der kastes, når et regex-mønster ikke kan kompileres.</summary>
public sealed class UgyldigRegexException : Exception
{
    public UgyldigRegexException(string message, Exception inner) : base(message, inner) { }
}

/// <summary>Omdøber ved hjælp af et .NET-regex-mønster med understøttelse af capture groups.</summary>
public sealed class RegexRenameRule : RenameRuleBase
{
    private string _moenster = string.Empty;
    private string _erstatning = string.Empty;
    private bool _forskelPaaStoreSmaa;
    private bool _kunFoersteMatch;
    private RegexTarget _maal = RegexTarget.NavnUdenFilendelse;

    public override string Navn => "Regex-omdøbning";

    public string Moenster
    {
        get => _moenster;
        set => SetField(ref _moenster, value ?? string.Empty);
    }

    public string Erstatning
    {
        get => _erstatning;
        set => SetField(ref _erstatning, value ?? string.Empty);
    }

    public bool ForskelPaaStoreSmaaBogstaver
    {
        get => _forskelPaaStoreSmaa;
        set => SetField(ref _forskelPaaStoreSmaa, value);
    }

    public bool KunFoersteMatch
    {
        get => _kunFoersteMatch;
        set => SetField(ref _kunFoersteMatch, value);
    }

    public RegexTarget Maal
    {
        get => _maal;
        set => SetField(ref _maal, value);
    }

    /// <summary>
    /// Validerer det aktuelle mønster og returnerer en dansk fejlbesked, hvis det er ugyldigt.
    /// Returnerer null hvis mønsteret er gyldigt (eller tomt).
    /// </summary>
    public string? ValiderMoenster()
    {
        if (string.IsNullOrEmpty(Moenster)) return null;
        try
        {
            _ = new Regex(Moenster);
            return null;
        }
        catch (ArgumentException ex)
        {
            return $"Regex-mønsteret er ugyldigt: {ex.Message}";
        }
    }

    public override WorkingFileName Anvend(WorkingFileName input, RenameRuleContext context)
    {
        if (!ErAktiveret || string.IsNullOrEmpty(Moenster))
            return input;

        var options = ForskelPaaStoreSmaaBogstaver ? RegexOptions.None : RegexOptions.IgnoreCase;

        Regex regex;
        try
        {
            regex = new Regex(Moenster, options);
        }
        catch (ArgumentException ex)
        {
            throw new UgyldigRegexException($"Regex-mønsteret er ugyldigt: {ex.Message}", ex);
        }

        var antalErstatninger = KunFoersteMatch ? 1 : int.MaxValue;

        if (Maal == RegexTarget.NavnUdenFilendelse)
        {
            var nytNavn = regex.Replace(input.NameWithoutExtension, Erstatning, antalErstatninger);
            return input with { NameWithoutExtension = nytNavn };
        }

        var heleFilnavnet = input.FullName;
        var resultat = regex.Replace(heleFilnavnet, Erstatning, antalErstatninger);

        var nyExtension = Path.GetExtension(resultat);
        var nytBasisNavn = nyExtension.Length > 0 ? resultat[..^nyExtension.Length] : resultat;
        return new WorkingFileName(nytBasisNavn, nyExtension);
    }
}
