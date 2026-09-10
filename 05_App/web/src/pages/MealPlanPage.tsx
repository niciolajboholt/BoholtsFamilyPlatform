import { useEffect, useState } from "react";

import { ChevronLeftRounded, ChevronRightRounded, RestaurantMenuRounded, TodayRounded } from "@mui/icons-material";
import { Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";

import { FeatureDisabledNotice } from "../components/FeatureDisabledNotice";
import { GenerateShoppingDraftDialog } from "../features/mealPlan/components/GenerateShoppingDraftDialog";
import { MealPlanWeekGrid } from "../features/mealPlan/components/MealPlanWeekGrid";
import { useMealPlan } from "../features/mealPlan/hooks/useMealPlan";
import { useFamilyId } from "../features/calendar/hooks/useFamilyId";
import { useEnabledFeatures } from "../features/family/hooks/useEnabledFeatures";
import { addShoppingListItem, getShoppingLists, type ShoppingListDto } from "../features/shoppingList/shoppingListApi";

function MealPlanPage() {
  const {
    weekStart,
    days,
    isLoading,
    setDish,
    generateIngredientsDraft,
    hasAnyDish,
    goToPreviousWeek,
    goToNextWeek,
    goToThisWeek,
  } = useMealPlan();
  const familyId = useFamilyId();
  const [lists, setLists] = useState<ShoppingListDto[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!familyId) {
      return;
    }

    getShoppingLists(familyId).then((result) => {
      if (result.ok && result.data.lists) {
        setLists(result.data.lists);
      }
    });
  }, [familyId]);

  async function handleAddSelected(listId: string, itemNames: string[]): Promise<void> {
    if (!familyId) {
      return;
    }

    // Ét ad gangen, afventet — samme mønster som
    // useShoppingList.addSuggestedItems, undgår at flere samtidige
    // POST-svar kapløber om at være det sidste.
    for (const name of itemNames) {
      await addShoppingListItem(familyId, listId, name);
    }
  }

  const weekRangeLabel = (() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    const formatter = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short" });
    return `${formatter.format(weekStart)} – ${formatter.format(end)}`;
  })();

  const { isEnabled, isLoading: isFeatureLoading } = useEnabledFeatures();

  if (!isFeatureLoading && !isEnabled("meal-plan")) {
    return <FeatureDisabledNotice />;
  }

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Måltidsplan</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Planlæg ugens retter, og generér indkøb ud fra dem.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton aria-label="Forrige uge" onClick={goToPreviousWeek}>
            <ChevronLeftRounded />
          </IconButton>
          <Typography sx={{ minWidth: 140, textAlign: "center" }}>{weekRangeLabel}</Typography>
          <IconButton aria-label="Næste uge" onClick={goToNextWeek}>
            <ChevronRightRounded />
          </IconButton>
          <IconButton aria-label="Denne uge" onClick={goToThisWeek}>
            <TodayRounded fontSize="small" />
          </IconButton>
        </Box>

        <Button
          variant="contained"
          startIcon={<RestaurantMenuRounded />}
          onClick={() => setIsDialogOpen(true)}
        >
          Foreslå indkøb
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <MealPlanWeekGrid days={days} onSetDish={setDish} />
      )}

      <GenerateShoppingDraftDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        lists={lists}
        hasAnyDish={hasAnyDish}
        onGenerate={generateIngredientsDraft}
        onAddSelected={handleAddSelected}
      />
    </Box>
  );
}

export default MealPlanPage;
