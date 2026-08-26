using Filnavnevaerktoej.App.ViewModels;
using Filnavnevaerktoej.Core.Models;

namespace Filnavnevaerktoej.App.Converters;

public sealed class EnumOption
{
    public required object Vaerdi { get; init; }
    public required string Tekst { get; init; }
}

/// <summary>Statiske dansksprogede visningslister til ComboBoxe, der er bundet til enum-egenskaber.</summary>
public static class EnumOptions
{
    public static IReadOnlyList<EnumOption> AddTextPlacementOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = AddTextPlacement.Start, Tekst = "I starten af filnavnet" },
        new() { Vaerdi = AddTextPlacement.Slutning, Tekst = "I slutningen af filnavnet" },
        new() { Vaerdi = AddTextPlacement.FoerTekst, Tekst = "Før en bestemt tekst" },
        new() { Vaerdi = AddTextPlacement.EfterTekst, Tekst = "Efter en bestemt tekst" },
        new() { Vaerdi = AddTextPlacement.VedPosition, Tekst = "Ved tegnposition" },
        new() { Vaerdi = AddTextPlacement.FoerFilendelse, Tekst = "Før filendelsen" },
    };

    public static IReadOnlyList<EnumOption> ReplaceScopeOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = ReplaceScope.AlleForekomster, Tekst = "Erstat alle forekomster" },
        new() { Vaerdi = ReplaceScope.FoersteForekomst, Tekst = "Erstat kun første forekomst" },
        new() { Vaerdi = ReplaceScope.SidsteForekomst, Tekst = "Erstat kun sidste forekomst" },
    };

    public static IReadOnlyList<EnumOption> RegexTargetOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = RegexTarget.NavnUdenFilendelse, Tekst = "Anvend på filnavn uden filendelse" },
        new() { Vaerdi = RegexTarget.HeleFilnavnet, Tekst = "Anvend på hele filnavnet inklusive filendelse" },
    };

    public static IReadOnlyList<EnumOption> CaseChangeModeOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = CaseChangeMode.IngenAendring, Tekst = "Ingen ændring" },
        new() { Vaerdi = CaseChangeMode.SmaaBogstaver, Tekst = "Alt med små bogstaver" },
        new() { Vaerdi = CaseChangeMode.StoreBogstaver, Tekst = "Alt med store bogstaver" },
        new() { Vaerdi = CaseChangeMode.FoersteBogstavStort, Tekst = "Første bogstav stort" },
        new() { Vaerdi = CaseChangeMode.TitelFormat, Tekst = "Titel-format" },
    };

    public static IReadOnlyList<EnumOption> NumberingPlacementOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = NumberingPlacement.Start, Tekst = "I starten" },
        new() { Vaerdi = NumberingPlacement.Slutning, Tekst = "I slutningen" },
    };

    public static IReadOnlyList<EnumOption> ForhaandsvisningsFilterOptions { get; } = new List<EnumOption>
    {
        new() { Vaerdi = ForhaandsvisningsFilter.Alle, Tekst = "Alle" },
        new() { Vaerdi = ForhaandsvisningsFilter.KunAendringer, Tekst = "Kun ændringer" },
        new() { Vaerdi = ForhaandsvisningsFilter.KunFejl, Tekst = "Kun fejl" },
        new() { Vaerdi = ForhaandsvisningsFilter.KunUaendrede, Tekst = "Kun uændrede" },
        new() { Vaerdi = ForhaandsvisningsFilter.KunAdvarsler, Tekst = "Kun advarsler" },
    };
}
