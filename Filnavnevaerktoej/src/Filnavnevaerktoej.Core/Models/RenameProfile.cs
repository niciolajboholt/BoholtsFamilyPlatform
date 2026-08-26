using Filnavnevaerktoej.Core.Rules;

namespace Filnavnevaerktoej.Core.Models;

/// <summary>
/// En gemt samling af omdøbningsregler og filter-indstillinger, som brugeren kan genbruge.
/// Indeholder bevidst ikke en mappesti, da en profil skal kunne bruges på tværs af mapper.
/// </summary>
public sealed class RenameProfile
{
    public required string Navn { get; set; }
    public string FilFilter { get; set; } = "*.*";
    public bool MedtagUndermapper { get; set; }
    public bool TilladAendringAfFilendelser { get; set; }
    public List<IRenameRule> Regler { get; set; } = new();
    public DateTime SidstAendretUtc { get; set; } = DateTime.UtcNow;
}
