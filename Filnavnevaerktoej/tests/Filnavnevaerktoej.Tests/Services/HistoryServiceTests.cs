using Filnavnevaerktoej.Core.Models;
using Filnavnevaerktoej.Core.Services;
using Filnavnevaerktoej.Tests.TestSupport;
using Xunit;

namespace Filnavnevaerktoej.Tests.Services;

public class HistoryServiceTests
{
    private static RenameOperation LavOperation() => new()
    {
        OperationId = Guid.NewGuid().ToString("N"),
        TidspunktUtc = DateTime.UtcNow,
        KildeMappe = @"C:\Test",
        Entries = new List<RenameOperationEntry>
        {
            new()
            {
                OprindeligFuldSti = @"C:\Test\a.txt",
                NyFuldSti = @"C:\Test\b.txt",
                Resultat = RenameEntryResult.Succes
            }
        }
    };

    [Fact]
    public async Task GemOgHent_Roundtrip_BevarerAlleFelter()
    {
        using var mappe = new TempTestFolder();
        var service = new HistoryService(mappe.Sti);
        var operation = LavOperation();

        await service.GemAsync(operation);
        var hentet = await service.HentAsync(operation.OperationId);

        Assert.NotNull(hentet);
        Assert.Equal(operation.OperationId, hentet!.OperationId);
        Assert.Equal(operation.KildeMappe, hentet.KildeMappe);
        Assert.Single(hentet.Entries);
        Assert.Equal(RenameEntryResult.Succes, hentet.Entries[0].Resultat);
    }

    [Fact]
    public async Task HentAlleAsync_ReturnererNyesteFoerst()
    {
        using var mappe = new TempTestFolder();
        var service = new HistoryService(mappe.Sti);

        var aeldre = LavOperation();
        var nyere = LavOperation();

        await service.GemAsync(new RenameOperation
        {
            OperationId = aeldre.OperationId,
            TidspunktUtc = DateTime.UtcNow.AddHours(-2),
            KildeMappe = aeldre.KildeMappe,
            Entries = aeldre.Entries
        });
        await service.GemAsync(nyere);

        var alle = await service.HentAlleAsync();

        Assert.Equal(2, alle.Count);
        Assert.Equal(nyere.OperationId, alle[0].OperationId);
    }

    [Fact]
    public async Task HentAsync_UkendtId_ReturnererNull()
    {
        using var mappe = new TempTestFolder();
        var service = new HistoryService(mappe.Sti);

        var hentet = await service.HentAsync("findes-ikke");

        Assert.Null(hentet);
    }
}
