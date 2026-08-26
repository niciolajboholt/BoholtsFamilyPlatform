namespace Filnavnevaerktoej.Core.Models;

/// <summary>Én linje i den levende forhåndsvisning af en planlagt omdøbning.</summary>
public sealed class RenamePreviewItem
{
    public required FileItem Kilde { get; init; }
    public required string GammeltFilnavn { get; init; }
    public required string NytFilnavn { get; init; }
    public required string Mappe { get; init; }
    public RenameStatus Status { get; set; }
    public string Bemaerkning { get; set; } = string.Empty;

    public bool AendresRentFaktisk =>
        !string.Equals(GammeltFilnavn, NytFilnavn, StringComparison.Ordinal);

    public string GammelFuldSti => Path.Combine(Mappe, GammeltFilnavn);
    public string NyFuldSti => Path.Combine(Mappe, NytFilnavn);
}
