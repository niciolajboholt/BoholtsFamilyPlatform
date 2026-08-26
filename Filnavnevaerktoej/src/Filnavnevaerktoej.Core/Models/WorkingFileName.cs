namespace Filnavnevaerktoej.Core.Models;

/// <summary>
/// Mutérbar arbejdstilstand for et filnavn under anvendelse af omdøbningsregler.
/// Navn og filendelse holdes adskilt, så regler som standard kun kan påvirke navnedelen.
/// </summary>
public sealed record WorkingFileName(string NameWithoutExtension, string Extension)
{
    public string FullName => NameWithoutExtension + Extension;

    public static WorkingFileName FromFileItem(FileItem file) =>
        new(file.NameWithoutExtension, file.Extension);
}

/// <summary>Kontekst en omdøbningsregel får stillet til rådighed, når den anvendes på en fil.</summary>
public sealed class RenameRuleContext
{
    public required string OriginalFileName { get; init; }
    public required string OriginalExtension { get; init; }

    /// <summary>0-baseret position blandt de filer, der indgår i den aktuelle omdøbning (bruges til nummerering).</summary>
    public int Index { get; init; }
}
