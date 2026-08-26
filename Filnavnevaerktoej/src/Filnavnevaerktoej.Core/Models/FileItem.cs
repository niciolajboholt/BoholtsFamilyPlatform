namespace Filnavnevaerktoej.Core.Models;

/// <summary>Repræsenterer en fil, der er fundet under scanning af en mappe.</summary>
public sealed class FileItem
{
    public required string FullPath { get; init; }
    public required string FileName { get; init; }
    public required string Extension { get; init; }
    public required string DirectoryPath { get; init; }
    public long SizeBytes { get; init; }
    public DateTime LastModifiedUtc { get; init; }
    public bool IsHidden { get; init; }
    public bool IsSystem { get; init; }
    public bool IsReadOnly { get; init; }

    public string NameWithoutExtension =>
        Extension.Length > 0 && FileName.EndsWith(Extension, StringComparison.OrdinalIgnoreCase)
            ? FileName[..^Extension.Length]
            : FileName;
}
