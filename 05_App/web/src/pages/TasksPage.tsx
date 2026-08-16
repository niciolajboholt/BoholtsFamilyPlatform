import { useState } from "react";
import type { FormEvent } from "react";

import { AddRounded, AutoAwesomeOutlined, DeleteOutlineRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import { useCurrentMember } from "../features/calendar/hooks/useCurrentMember";
import { useTasks } from "../features/tasks/hooks/useTasks";
import { taskIconComponents, taskIconLabels, taskIcons, type TaskIconKey } from "../features/tasks/taskIcons";
import type { NewRoutineItemInput, RoutineDraft, TaskDto } from "../features/tasks/tasksApi";

type ViewMode = "mine" | "family";

const weekdayLabels: { value: number; label: string }[] = [
  { value: 1, label: "Man" },
  { value: 2, label: "Tir" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lør" },
  { value: 7, label: "Søn" },
];

function TaskIcon({ icon }: { icon: string }) {
  const Icon = taskIconComponents[icon as TaskIconKey] ?? taskIconComponents.fritid;
  return <Icon fontSize="small" />;
}

function TasksPage() {
  const { currentMember } = useCurrentMember();
  const {
    isLoading,
    error,
    members,
    tasks,
    routines,
    addNewTask,
    toggleDone,
    renameTask,
    setTaskIcon,
    removeTask,
    clearDone,
    createRoutine,
    removeRoutine,
    suggestRoutine,
  } = useTasks();

  const [viewMode, setViewMode] = useState<ViewMode>("mine");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskIcon, setNewTaskIcon] = useState<TaskIconKey>("fritid");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  const [iconMenuAnchor, setIconMenuAnchor] = useState<HTMLElement | null>(null);
  const [isRoutineDialogOpen, setIsRoutineDialogOpen] = useState(false);

  const visibleTasks = tasks.filter((task) => {
    if (viewMode === "family") {
      return true;
    }

    return task.assignedMemberId === null || task.assignedMemberId === currentMember?.id;
  });

  const hasDoneTasks = visibleTasks.some((task) => Boolean(task.isDone));

  function handleAddTask(event: FormEvent): void {
    event.preventDefault();

    if (!newTaskName.trim()) {
      return;
    }

    addNewTask(newTaskName, newTaskIcon, newTaskAssignee || null);
    setNewTaskName("");
  }

  function memberName(memberId: string | null): string | null {
    if (!memberId) {
      return null;
    }

    return members.find((member) => member.id === memberId)?.name ?? null;
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", pb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Opgaver</Typography>

        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Engangsopgaver og faste rutiner for familien.
        </Typography>
      </Box>

      <Tabs value={viewMode} onChange={(_event, value: ViewMode) => setViewMode(value)} sx={{ mb: 2 }}>
        <Tab value="mine" label="Min dag" />
        <Tab value="family" label="Familien" />
      </Tabs>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box component="form" onSubmit={handleAddTask} sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
            <IconButton
              aria-label="Vælg ikon"
              onClick={(event) => setIconMenuAnchor(event.currentTarget)}
              sx={{ border: "1px solid", borderColor: "divider" }}
            >
              <TaskIcon icon={newTaskIcon} />
            </IconButton>

            <Menu anchorEl={iconMenuAnchor} open={Boolean(iconMenuAnchor)} onClose={() => setIconMenuAnchor(null)}>
              {taskIcons.map((icon) => (
                <MenuItem
                  key={icon}
                  selected={icon === newTaskIcon}
                  onClick={() => {
                    setNewTaskIcon(icon);
                    setIconMenuAnchor(null);
                  }}
                >
                  <TaskIcon icon={icon} />
                  <Typography sx={{ ml: 1.5 }}>{taskIconLabels[icon]}</Typography>
                </MenuItem>
              ))}
            </Menu>

            <TextField
              size="small"
              placeholder="Tilføj en opgave…"
              value={newTaskName}
              onChange={(event) => setNewTaskName(event.target.value)}
              sx={{ flexGrow: 1, minWidth: 160 }}
            />

            <TextField
              select
              size="small"
              value={newTaskAssignee}
              onChange={(event) => setNewTaskAssignee(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="">Hele familien</MenuItem>
              {members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.name}
                </MenuItem>
              ))}
            </TextField>

            <Button type="submit" variant="contained" disabled={!newTaskName.trim()}>
              Tilføj
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : visibleTasks.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
              Ingen opgaver endnu i dag.
            </Typography>
          ) : (
            <Box>
              {visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  assigneeName={memberName(task.assignedMemberId)}
                  onToggleDone={toggleDone}
                  onRename={renameTask}
                  onChangeIcon={setTaskIcon}
                  onDelete={removeTask}
                />
              ))}

              {hasDoneTasks && (
                <Box sx={{ mt: 2, textAlign: "right" }}>
                  <Button size="small" onClick={clearDone}>
                    Ryd udførte
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography variant="h6">Rutiner</Typography>

            <Button size="small" startIcon={<AddRounded />} onClick={() => setIsRoutineDialogOpen(true)}>
              Opret rutine
            </Button>
          </Box>

          {routines.length === 0 ? (
            <Typography color="text.secondary">Ingen rutiner endnu.</Typography>
          ) : (
            routines.map((routine, index) => (
              <Box key={routine.id}>
                {index > 0 && <Divider sx={{ my: 1.5 }} />}

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{routine.name}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                      {weekdayLabels
                        .filter((day) => routine.weekdays.includes(day.value))
                        .map((day) => (
                          <Chip key={day.value} label={day.label} size="small" />
                        ))}
                    </Box>
                  </Box>

                  <IconButton
                    aria-label={`Slet ${routine.name}`}
                    size="small"
                    onClick={() => removeRoutine(routine.id)}
                  >
                    <DeleteOutlineRounded fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      <RoutineCreateDialog
        open={isRoutineDialogOpen}
        onClose={() => setIsRoutineDialogOpen(false)}
        members={members}
        onCreate={createRoutine}
        onSuggest={suggestRoutine}
      />
    </Box>
  );
}

interface TaskRowProps {
  task: TaskDto;
  assigneeName: string | null;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  onRename: (taskId: string, name: string) => void;
  onChangeIcon: (taskId: string, icon: string) => void;
  onDelete: (taskId: string) => void;
}

function TaskRow({ task, assigneeName, onToggleDone, onRename, onChangeIcon, onDelete }: TaskRowProps) {
  const [iconMenuAnchor, setIconMenuAnchor] = useState<HTMLElement | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.name);

  function commitNameEdit(): void {
    setIsEditingName(false);

    if (!nameDraft.trim() || nameDraft.trim() === task.name) {
      return;
    }

    onRename(task.id, nameDraft);
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        py: 0.5,
        opacity: task.isDone ? 0.5 : 1,
      }}
    >
      <Checkbox
        checked={Boolean(task.isDone)}
        onChange={(event) => onToggleDone(task.id, event.target.checked)}
      />

      <IconButton aria-label="Skift ikon" size="small" onClick={(event) => setIconMenuAnchor(event.currentTarget)}>
        <TaskIcon icon={task.icon} />
      </IconButton>

      <Menu anchorEl={iconMenuAnchor} open={Boolean(iconMenuAnchor)} onClose={() => setIconMenuAnchor(null)}>
        {taskIcons.map((icon) => (
          <MenuItem
            key={icon}
            selected={icon === task.icon}
            onClick={() => {
              setIconMenuAnchor(null);
              onChangeIcon(task.id, icon);
            }}
          >
            <TaskIcon icon={icon} />
            <Typography sx={{ ml: 1.5 }}>{taskIconLabels[icon as TaskIconKey]}</Typography>
          </MenuItem>
        ))}
      </Menu>

      {isEditingName ? (
        <TextField
          autoFocus
          size="small"
          fullWidth
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitNameEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              setIsEditingName(false);
            }
          }}
          sx={{ flexGrow: 1 }}
        />
      ) : (
        <Box sx={{ flexGrow: 1, minWidth: 0 }} onClick={() => setIsEditingName(true)}>
          <Typography
            sx={{
              cursor: "pointer",
              textDecoration: task.isDone ? "line-through" : "none",
            }}
          >
            {task.name}
          </Typography>

          <Box sx={{ display: "flex", gap: 0.75 }}>
            {task.timeOfDay && (
              <Typography variant="caption" color="text.secondary">
                {task.timeOfDay}
              </Typography>
            )}
            {assigneeName && (
              <Typography variant="caption" color="text.secondary">
                {task.timeOfDay ? "· " : ""}
                {assigneeName}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      <IconButton aria-label={`Fjern ${task.name}`} size="small" onClick={() => onDelete(task.id)}>
        <DeleteOutlineRounded fontSize="small" />
      </IconButton>
    </Box>
  );
}

interface RoutineCreateDialogProps {
  open: boolean;
  onClose: () => void;
  members: { id: string; name: string }[];
  onCreate: (
    name: string,
    weekdays: number[],
    items: NewRoutineItemInput[],
    assignedMemberId?: string | null,
  ) => void;
  onSuggest: (description: string) => Promise<RoutineDraft>;
}

function RoutineCreateDialog({ open, onClose, members, onCreate, onSuggest }: RoutineCreateDialogProps) {
  const [name, setName] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [assignedMemberId, setAssignedMemberId] = useState("");
  const [items, setItems] = useState<NewRoutineItemInput[]>([{ name: "", icon: "fritid" }]);
  const [aiDescription, setAiDescription] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  function reset(): void {
    setName("");
    setWeekdays([]);
    setAssignedMemberId("");
    setItems([{ name: "", icon: "fritid" }]);
    setAiDescription("");
    setSuggestError(null);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  function handleSuggest(): void {
    if (!aiDescription.trim()) {
      return;
    }

    setIsSuggesting(true);
    setSuggestError(null);

    onSuggest(aiDescription)
      .then((draft) => {
        setName(draft.name);
        setItems(draft.items.map((item) => ({ name: item.name, icon: item.icon, timeOfDay: item.timeOfDay })));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Kunne ikke generere et forslag.";
        setSuggestError(message);
      })
      .finally(() => setIsSuggesting(false));
  }

  function updateItem(index: number, patch: Partial<NewRoutineItemInput>): void {
    setItems((previousItems) =>
      previousItems.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItemRow(index: number): void {
    setItems((previousItems) => previousItems.filter((_, itemIndex) => itemIndex !== index));
  }

  const validItems = items.filter((item) => item.name.trim());
  const canCreate = name.trim() && weekdays.length > 0 && validItems.length > 0;

  function handleCreate(): void {
    if (!canCreate) {
      return;
    }

    onCreate(name, weekdays, validItems, assignedMemberId || null);
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Opret rutine</DialogTitle>

      <DialogContent sx={{ display: "grid", gap: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Beskriv rutinen, så foreslår AI'en opgaverne (valgfrit)
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Fx morgenrutine med tandbørstning, tøj og skoletaske"
              value={aiDescription}
              onChange={(event) => setAiDescription(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSuggest();
                }
              }}
            />
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeOutlined />}
              onClick={handleSuggest}
              disabled={!aiDescription.trim() || isSuggesting}
            >
              Foreslå
            </Button>
          </Box>
          {isSuggesting && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
              <CircularProgress size={20} />
            </Box>
          )}
          {suggestError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {suggestError}
            </Alert>
          )}
        </Box>

        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label="Rutinens navn"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <Box>
          <Typography variant="caption" color="text.secondary">
            Ugedage
          </Typography>
          <ToggleButtonGroup
            value={weekdays}
            onChange={(_event, value: number[]) => setWeekdays(value)}
            size="small"
            sx={{ display: "flex", flexWrap: "wrap", mt: 0.5 }}
          >
            {weekdayLabels.map((day) => (
              <ToggleButton key={day.value} value={day.value}>
                {day.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <TextField
          select
          label="Tildel til"
          value={assignedMemberId}
          onChange={(event) => setAssignedMemberId(event.target.value)}
        >
          <MenuItem value="">Hele familien</MenuItem>
          {members.map((member) => (
            <MenuItem key={member.id} value={member.id}>
              {member.name}
            </MenuItem>
          ))}
        </TextField>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Opgaver i rutinen
          </Typography>

          {items.map((item, index) => (
            <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1 }}>
              <TextField
                select
                size="small"
                value={item.icon}
                onChange={(event) => updateItem(index, { icon: event.target.value })}
                sx={{ minWidth: 120 }}
              >
                {taskIcons.map((icon) => (
                  <MenuItem key={icon} value={icon}>
                    {taskIconLabels[icon]}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                placeholder="Navn"
                value={item.name}
                onChange={(event) => updateItem(index, { name: event.target.value })}
                sx={{ flexGrow: 1 }}
              />

              <IconButton
                aria-label="Fjern opgave fra rutine"
                size="small"
                onClick={() => removeItemRow(index)}
                disabled={items.length === 1}
              >
                <DeleteOutlineRounded fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Button
            size="small"
            startIcon={<AddRounded />}
            onClick={() => setItems((previousItems) => [...previousItems, { name: "", icon: "fritid" }])}
            sx={{ mt: 1 }}
          >
            Tilføj opgave
          </Button>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Annuller</Button>
        <Button variant="contained" onClick={handleCreate} disabled={!canCreate}>
          Opret
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TasksPage;
