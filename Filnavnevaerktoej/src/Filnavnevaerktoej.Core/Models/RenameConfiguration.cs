using Filnavnevaerktoej.Core.Rules;

namespace Filnavnevaerktoej.Core.Models;

/// <summary>Det samlede regelsæt en forhåndsvisning eller omdøbning skal bygges ud fra.</summary>
public sealed class RenameConfiguration
{
    public List<IRenameRule> Regler { get; set; } = new();

    /// <summary>Avanceret indstilling, slået fra som standard. Når false tvinges filendelsen til at være uændret.</summary>
    public bool TilladAendringAfFilendelser { get; set; }
}

/// <summary>Fremdrift under scanning eller omdøbning, til brug for en fremdriftslinje i UI.</summary>
public sealed record RenameFremdrift(int Behandlet, int Total, string Besked);
