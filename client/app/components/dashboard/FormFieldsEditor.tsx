"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { FieldGroup, FormField, FieldType } from "@/app/lib/types";
import ConfirmDeleteDialog from "@/components/ui/confirm-delete-dialog";
import {
  Plus,
  GripVertical,
  Trash2,
  Type,
  AlignLeft,
  ChevronDown,
  Upload,
  Mail,
  Phone,
  Link as LinkIcon,
  Hash,
  Calendar,
  Settings2,
  ChevronUp,
  Sparkles,
  Check,
  X,
  MoreHorizontal,
  Copy,
  EyeOff,
  AlertCircle,
  GripHorizontal,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(_[\s\S]*?_|\*[\s\S]*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <strong key={i} className="font-bold">
          {part.slice(1, -1)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

interface FormFieldsEditorProps {
  groups: FieldGroup[];
  onChange: (groups: FieldGroup[]) => void;
}

const FIELD_TYPES = [
  { value: FieldType.TEXT, label: "Texto curto", icon: Type },
  { value: FieldType.TEXTAREA, label: "Texto longo", icon: AlignLeft },
  { value: FieldType.SELECT, label: "Seleção múltipla", icon: ChevronDown },
  { value: FieldType.SCALE, label: "Escala de Satisfação", icon: GripHorizontal },
  { value: FieldType.EMAIL, label: "E-mail", icon: Mail },
  { value: FieldType.PHONE, label: "Telefone", icon: Phone },
  { value: FieldType.FILE, label: "Upload de arquivo", icon: Upload },
  { value: "url", label: "Link / URL", icon: LinkIcon },
  { value: "number", label: "Número", icon: Hash },
];

export default function FormFieldsEditor({ groups, onChange }: FormFieldsEditorProps) {
  const [editingField, setEditingField] = useState<{ groupId: string; field: FormField } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    type: "group" | "field";
    groupId: string;
    fieldId?: string;
    label: string;
  } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // ── Drag & Drop State ──
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<{ groupId: string; fieldId: string } | null>(null);
  const [dropTargetGroup, setDropTargetGroup] = useState<string | null>(null);
  const [dropTargetField, setDropTargetField] = useState<{ groupId: string; fieldId: string } | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  // Cleanup drag preview element on unmount or when drag ends
  useEffect(() => {
    return () => {
      if (dragPreviewRef.current) {
        document.body.removeChild(dragPreviewRef.current);
        dragPreviewRef.current = null;
      }
    };
  }, []);

  // ── Group helpers ──
  const addGroup = () => {
    onChange([...groups, { id: uuidv4(), name: "Nova Seção", fields: [] }]);
  };

  const removeGroup = (id: string) => {
    onChange(groups.filter((g) => g.id !== id));
    if (editingField?.groupId === id) setEditingField(null);
  };

  const updateGroup = (id: string, updates: Partial<FieldGroup>) => {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  const duplicateGroup = (id: string) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const newGroup = {
      ...group,
      id: uuidv4(),
      name: `${group.name} (Cópia)`,
      fields: group.fields.map((f) => ({ ...f, id: uuidv4() })),
    };
    const index = groups.findIndex((g) => g.id === id);
    const newGroups = [...groups];
    newGroups.splice(index + 1, 0, newGroup);
    onChange(newGroups);
  };

  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const moveGroup = (i: number, d: "up" | "down") => {
    const t = d === "up" ? i - 1 : i + 1;
    if (t < 0 || t >= groups.length) return;
    const g = [...groups];
    [g[i], g[t]] = [g[t], g[i]];
    onChange(g);
  };

  // ── Field helpers ──
  const addField = (groupId: string, type: string) => {
    const typeLabel = FIELD_TYPES.find((f) => f.value === type)?.label || "Campo";
    const mappedType = Object.values(FieldType).includes(type as FieldType) ? (type as FieldType) : FieldType.TEXT;

    const newField: FormField = { id: uuidv4(), type: mappedType, label: typeLabel, required: false };

    onChange(groups.map((g) => (g.id === groupId ? { ...g, fields: [...g.fields, newField] } : g)));
    // Auto-open inspector for the new field
    setEditingField({ groupId, field: newField });
  };

  const removeField = (gId: string, fId: string) => {
    onChange(groups.map((g) => (g.id === gId ? { ...g, fields: g.fields.filter((f) => f.id !== fId) } : g)));
    if (editingField?.field.id === fId) setEditingField(null);
  };

  const updateField = (gId: string, fId: string, u: Partial<FormField>) => {
    onChange(
      groups.map((g) =>
        g.id === gId ? { ...g, fields: g.fields.map((f) => (f.id === fId ? { ...f, ...u } : f)) } : g,
      ),
    );
    if (editingField?.field.id === fId) {
      setEditingField({ groupId: gId, field: { ...editingField.field, ...u } as FormField });
    }
  };

  const moveField = (gId: string, i: number, d: "up" | "down") => {
    const group = groups.find((g) => g.id === gId);
    if (!group) return;
    const t = d === "up" ? i - 1 : i + 1;
    if (t < 0 || t >= group.fields.length) return;
    const f = [...group.fields];
    [f[i], f[t]] = [f[t], f[i]];
    onChange(groups.map((g) => (g.id === gId ? { ...g, fields: f } : g)));
  };

  // ── Drag & Drop Handlers ──
  const dropPositionRef = useRef<"before" | "after" | null>(null);
  const dropTargetGroupRef = useRef<string | null>(null);
  const dropTargetFieldRef = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, type: "group" | "field", id: string, parentId?: string) => {
    e.stopPropagation();

    // Clean up previous preview if any
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }

    // Create custom drag preview element
    const preview = document.createElement("div");
    preview.style.cssText = `
      position: fixed; top: -1000px; left: -1000px;
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 12px;
      background: white; border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      font-family: inherit; max-width: 320px; z-index: 99999;
      pointer-events: none;
    `;

    if (type === "group") {
      const group = groups.find((g) => g.id === id);
      preview.innerHTML = `
        <div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
        </div>
        <div style="overflow:hidden">
          <div style="font-size:13px;font-weight:700;color:#18181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${group?.name || "Seção"}</div>
          <div style="font-size:11px;color:#a1a1aa;margin-top:1px">${group?.fields.length || 0} campos</div>
        </div>
      `;
      setDraggedGroup(id);
    } else if (type === "field" && parentId) {
      const group = groups.find((g) => g.id === parentId);
      const field = group?.fields.find((f) => f.id === id);
      const typeInfo = FIELD_TYPES.find((t) => t.value === field?.type) || FIELD_TYPES[0];

      // Map Lucide icon names to simple SVG paths for the preview
      const iconSvgs: Record<string, string> = {
        "Texto curto":
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
        "Texto longo":
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>',
        "Seleção múltipla":
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
      };
      const iconHtml = iconSvgs[typeInfo.label] || iconSvgs["Texto curto"];

      preview.innerHTML = `
        <div style="width:28px;height:28px;border-radius:8px;background:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:white">
          ${iconHtml}
        </div>
        <div style="overflow:hidden">
          <div style="font-size:13px;font-weight:600;color:#18181b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${field?.label || "Campo sem título"}</div>
          <div style="font-size:11px;color:#a1a1aa;margin-top:1px">${typeInfo.label}</div>
        </div>
      `;
      setDraggedField({ groupId: parentId, fieldId: id });
    }

    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
    e.dataTransfer.setDragImage(preview, 24, 24);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = useCallback(
    (e: React.DragEvent, type: "group" | "field", id: string, parentId?: string) => {
      e.preventDefault();
      e.stopPropagation();

      // Calculate positioning (before or after)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const newPosition = e.clientY > rect.top + rect.height / 2 ? "after" : "before";

      // Only update state when values actually change to avoid excessive re-renders
      if (dropPositionRef.current !== newPosition) {
        dropPositionRef.current = newPosition;
        setDropPosition(newPosition);
      }

      if (type === "group" && draggedGroup && draggedGroup !== id) {
        if (dropTargetGroupRef.current !== id) {
          dropTargetGroupRef.current = id;
          dropTargetFieldRef.current = null;
          setDropTargetGroup(id);
          setDropTargetField(null);
        }
      } else if (type === "field" && draggedField) {
        if (draggedField.fieldId !== id && dropTargetFieldRef.current !== id) {
          dropTargetFieldRef.current = id;
          dropTargetGroupRef.current = null;
          setDropTargetField({ groupId: parentId!, fieldId: id });
          setDropTargetGroup(null);
        }
      } else if (type === "group" && draggedField && parentId === id) {
        // Dragging field into an empty group
        if (dropTargetGroupRef.current !== id) {
          dropTargetGroupRef.current = id;
          dropTargetFieldRef.current = null;
          setDropTargetGroup(id);
          setDropTargetField(null);
        }
      }
    },
    [draggedGroup, draggedField],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear state when the cursor truly leaves the element,
    // not when it moves to a child element inside the drop zone
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && (e.currentTarget as HTMLElement).contains(relatedTarget)) {
      return;
    }
    dropTargetGroupRef.current = null;
    dropTargetFieldRef.current = null;
    dropPositionRef.current = null;
    setDropTargetGroup(null);
    setDropTargetField(null);
    setDropPosition(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    // Clean up drag preview element
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
    dropTargetGroupRef.current = null;
    dropTargetFieldRef.current = null;
    dropPositionRef.current = null;
    setDraggedGroup(null);
    setDraggedField(null);
    setDropTargetGroup(null);
    setDropTargetField(null);
    setDropPosition(null);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newGroups = [...groups];

    if (draggedGroup && dropTargetGroup) {
      // Reorder groups
      const fromIndex = newGroups.findIndex((g) => g.id === draggedGroup);
      const toIndex = newGroups.findIndex((g) => g.id === dropTargetGroup);
      if (fromIndex !== -1 && toIndex !== -1) {
        const [moved] = newGroups.splice(fromIndex, 1);
        const insertIndex =
          dropPosition === "after"
            ? fromIndex < toIndex
              ? toIndex
              : toIndex + 1
            : fromIndex < toIndex
              ? toIndex - 1
              : toIndex;
        newGroups.splice(Math.max(0, insertIndex), 0, moved);
        onChange(newGroups);
      }
    } else if (draggedField && dropTargetField) {
      // Reorder fields (possibly across groups)
      const fromGroupIndex = newGroups.findIndex((g) => g.id === draggedField.groupId);
      const toGroupIndex = newGroups.findIndex((g) => g.id === dropTargetField.groupId);

      if (fromGroupIndex !== -1 && toGroupIndex !== -1) {
        const fromGroup = { ...newGroups[fromGroupIndex], fields: [...newGroups[fromGroupIndex].fields] };
        const toGroup =
          fromGroupIndex === toGroupIndex
            ? fromGroup
            : { ...newGroups[toGroupIndex], fields: [...newGroups[toGroupIndex].fields] };

        const fromFieldIndex = fromGroup.fields.findIndex((f) => f.id === draggedField.fieldId);
        const toFieldIndex = toGroup.fields.findIndex((f) => f.id === dropTargetField.fieldId);

        if (fromFieldIndex !== -1 && toFieldIndex !== -1) {
          const [moved] = fromGroup.fields.splice(fromFieldIndex, 1);

          // After splice, indices in `toGroup` shift if same group
          let adjustedToIndex = toFieldIndex;
          if (fromGroupIndex === toGroupIndex && fromFieldIndex < toFieldIndex) {
            adjustedToIndex = toFieldIndex - 1;
          }
          const insertIndex = dropPosition === "after" ? adjustedToIndex + 1 : adjustedToIndex;

          toGroup.fields.splice(Math.max(0, insertIndex), 0, moved);

          newGroups[fromGroupIndex] = fromGroup;
          newGroups[toGroupIndex] = toGroup;
          onChange(newGroups);
        }
      }
    } else if (draggedField && dropTargetGroup) {
      // Move field to an empty group
      const fromGroupIndex = newGroups.findIndex((g) => g.id === draggedField.groupId);
      const toGroupIndex = newGroups.findIndex((g) => g.id === dropTargetGroup);

      if (fromGroupIndex !== -1 && toGroupIndex !== -1) {
        const fromGroup = { ...newGroups[fromGroupIndex], fields: [...newGroups[fromGroupIndex].fields] };
        const toGroup = { ...newGroups[toGroupIndex], fields: [...newGroups[toGroupIndex].fields] };

        const fromFieldIndex = fromGroup.fields.findIndex((f) => f.id === draggedField.fieldId);
        if (fromFieldIndex !== -1 && toGroup.fields.length === 0) {
          const [moved] = fromGroup.fields.splice(fromFieldIndex, 1);
          toGroup.fields.push(moved);

          newGroups[fromGroupIndex] = fromGroup;
          newGroups[toGroupIndex] = toGroup;
          onChange(newGroups);
        }
      }
    }

    setDraggedGroup(null);
    setDraggedField(null);
    setDropTargetGroup(null);
    setDropTargetField(null);
    setDropPosition(null);
  };

  return (
    <>
      <div className="flex w-full h-full justify-center">
        {/* ─── BUILDER CANVAS (Left) ─── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-8 lg:py-12">
          <div className="max-w-2xl mx-auto space-y-6 pb-36 md:pb-24">
            <div className="mb-8">
              <h2 className="text-[20px] font-semibold text-foreground tracking-tight">Campos do Formulário</h2>
              <p className="text-[14px] text-zinc-500 dark:text-zinc-400 mt-1">
                Estruture as perguntas e informações que deseja coletar.
              </p>
            </div>

            {groups.map((group, gIndex) => {
              const isCollapsed = collapsedGroups[group.id];
              const isGroupDropTarget = dropTargetGroup === group.id && !draggedField;
              const isEmptyGroupDropTarget = dropTargetGroup === group.id && draggedField && group.fields.length === 0;

              return (
                <div
                  key={group.id}
                  className={cn(
                    "relative group/section space-y-2 transition-all p-1 rounded-2xl",
                    draggedGroup === group.id ? "opacity-40" : "opacity-100",
                    isGroupDropTarget && dropPosition === "before"
                      ? "border-t-[3px] border-primary rounded-none shadow-[0_-8px_24px_-8px_color-mix(in_oklch,var(--primary)_30%,transparent)] bg-gradient-to-b from-primary/5 to-transparent"
                      : "border-t-[3px] border-transparent",
                    isGroupDropTarget && dropPosition === "after"
                      ? "border-b-[3px] border-primary rounded-none shadow-[0_8px_24px_-8px_color-mix(in_oklch,var(--primary)_30%,transparent)] bg-gradient-to-t from-primary/5 to-transparent"
                      : "border-b-[3px] border-transparent",
                    isEmptyGroupDropTarget ? "border-2 border-dashed border-primary rounded-2xl bg-primary/5" : "",
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, "group", group.id)}
                  onDragOver={(e) => handleDragOver(e, "group", group.id, group.id)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-2 py-1 relative">
                    <div className="absolute -left-4 opacity-0 group-hover/section:opacity-100 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-opacity p-1">
                      <GripVertical size={16} />
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() => toggleGroupCollapse(group.id)}
                        className="w-5 h-5 flex items-center justify-center shrink-0 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                      >
                        <ChevronDown
                          size={14}
                          className={cn("transition-transform duration-200", isCollapsed ? "-rotate-90" : "rotate-0")}
                        />
                      </button>
                      <input
                        className="text-[14px] font-bold text-zinc-800 dark:text-zinc-200 bg-transparent focus:outline-none focus:bg-white dark:focus:bg-white/5 focus:ring-2 focus:ring-primary/20 rounded-md px-1.5 py-0.5 w-full min-w-0 max-w-[300px] transition-colors"
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                        placeholder="Nome da Seção"
                      />
                      <span className="text-[11.5px] font-medium text-zinc-400 px-2.5 py-0.5 bg-zinc-100 dark:bg-white/5 rounded-full ml-auto sm:ml-2 whitespace-nowrap shrink-0">
                        {group.fields.length} campos
                      </span>
                    </div>

                    {/* Group Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5"
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border-zinc-200/60 dark:border-white/10 text-[13px] p-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl"
                        >
                          <DropdownMenuItem
                            onClick={() => duplicateGroup(group.id)}
                            className="cursor-pointer py-2 rounded-md font-medium text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-white/5"
                          >
                            <Copy size={14} className="mr-2 opacity-70" /> Duplicar seção
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer py-2 rounded-md font-medium text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-white/5">
                            <EyeOff size={14} className="mr-2 opacity-70" /> Ocultar do cliente
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5 my-1" />
                          <DropdownMenuItem
                            onClick={() => {
                              setPendingDelete({
                                type: "group",
                                groupId: group.id,
                                label: group.name || "esta seção",
                              });
                            }}
                            className="cursor-pointer py-2 rounded-md font-medium text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/30"
                          >
                            <Trash2 size={14} className="mr-2 opacity-70" /> Deletar seção
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Fields List Container */}
                  <div
                    className={cn(
                      "transition-all duration-300 overflow-hidden",
                      isCollapsed ? "max-h-0 opacity-0" : "max-h-[5000px] opacity-100",
                    )}
                  >
                    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-zinc-200/60 dark:border-white/5 shadow-sm overflow-hidden flex flex-col pt-1">
                      {group.fields.length === 0 ? (
                        <div className="px-6 py-8 text-center flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-white/5 flex items-center justify-center mb-3">
                            <Type size={16} className="text-zinc-400" />
                          </div>
                          <p className="text-[13px] text-zinc-500 font-medium pb-2">Esta seção está vazia.</p>
                        </div>
                      ) : (
                        group.fields.map((field, fIndex) => {
                          const typeInfo = FIELD_TYPES.find((t) => t.value === field.type) || FIELD_TYPES[0];
                          const Icon = typeInfo.icon;
                          const isSelected = editingField?.field.id === field.id;
                          const isFieldDropTarget = dropTargetField?.fieldId === field.id;

                          return (
                            <div
                              key={field.id}
                              className={cn(
                                "relative group/field transition-all duration-150",
                                draggedField?.fieldId === field.id ? "opacity-30 scale-[0.98]" : "opacity-100",
                              )}
                              style={{
                                ...(isFieldDropTarget && dropPosition === "before"
                                  ? {
                                      borderTop: "2px solid var(--primary)",
                                      boxShadow:
                                        "0 -4px 12px -4px color-mix(in oklch, var(--primary) 30%, transparent)",
                                      marginTop: 4,
                                    }
                                  : { borderTop: "2px solid transparent" }),
                                ...(isFieldDropTarget && dropPosition === "after"
                                  ? {
                                      borderBottom: "3px solid var(--primary)",
                                      boxShadow: "0 4px 12px -4px color-mix(in oklch, var(--primary) 30%, transparent)",
                                      marginBottom: 4,
                                    }
                                  : { borderBottom: "3px solid transparent" }),
                              }}
                              draggable={!isSelected}
                              onDragStart={(e) => !isSelected && handleDragStart(e, "field", field.id, group.id)}
                              onDragOver={(e) => handleDragOver(e, "field", field.id, group.id)}
                              onDragLeave={handleDragLeave}
                              onDragEnd={handleDragEnd}
                              onDrop={handleDrop}
                            >
                              {fIndex > 0 && !isSelected && <div className="h-px bg-zinc-100 dark:bg-white/5 mx-14" />}

                              {isSelected ? (
                                <div className="flex flex-col gap-5 p-6 bg-white dark:bg-zinc-900 rounded-[20px] shadow-[0_8px_40px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.2)] my-4 mx-3 mb-6 ring-1 ring-zinc-200/50 dark:ring-white/10 relative transition-all">
                                  {/* Field Layout Stacked */}
                                  <div className="flex flex-col gap-4">
                                    {/* Title with Format Toolbar */}
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1 px-1">
                                        <Label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 flex-1">
                                          Pergunta do campo{" "}
                                          <span className="text-zinc-400 font-normal">
                                            (use _negrito_ ou *itálico*)
                                          </span>
                                        </Label>
                                      </div>
                                      <Textarea
                                        value={editingField.field.label}
                                        onChange={(e) => updateField(group.id, field.id, { label: e.target.value })}
                                        className="w-full min-h-[50px] text-[15px] font-semibold bg-zinc-100/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 focus:bg-white dark:focus:bg-[#1a1a1a] border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 outline-none px-4 py-3 resize-none rounded-xl transition-all shadow-none"
                                        placeholder="Ex: Qual o objetivo principal do site?"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 px-1">
                                        Tipo de resposta
                                      </Label>
                                      <Select
                                        value={editingField.field.type}
                                        onChange={(e) =>
                                          updateField(group.id, field.id, { type: e.target.value as FieldType })
                                        }
                                        className="w-full h-11 bg-zinc-100/50 dark:bg-white/5 border border-transparent hover:bg-zinc-100 dark:hover:bg-white/10 focus:border-zinc-300 dark:focus:border-zinc-700 rounded-lg transition-all"
                                      >
                                        {FIELD_TYPES.map((t) => (
                                          <option key={t.value} value={t.value}>
                                            {t.label}
                                          </option>
                                        ))}
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 px-1">
                                        Texto de apoio (Placeholder)
                                      </Label>
                                      <Input
                                        className="w-full h-11 text-[13px] bg-zinc-100/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 outline-none transition-all rounded-lg px-3 shadow-none"
                                        placeholder="Ex: Digite sua resposta..."
                                        value={editingField.field.placeholder || ""}
                                        onChange={(e) =>
                                          updateField(group.id, field.id, { placeholder: e.target.value })
                                        }
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300 px-1">
                                        Dica interna ou descrição
                                      </Label>
                                      <Input
                                        className="w-full h-11 text-[13px] bg-zinc-100/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 outline-none transition-all rounded-lg px-3 shadow-none"
                                        placeholder="Ex: Explique aqui algo sutilmente"
                                        value={editingField.field.description || ""}
                                        onChange={(e) =>
                                          updateField(group.id, field.id, { description: e.target.value })
                                        }
                                      />
                                    </div>
                                  </div>

                                  {/* Dynamic Content based on Type */}
                                  {editingField.field.type === FieldType.SELECT && (
                                    <div className="space-y-2 mt-2 pl-1 max-w-lg">
                                      <Label className="text-[12px] text-zinc-500 mb-2 block">Opções de seleção</Label>
                                      {(editingField.field.options || []).map((opt, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-3 group/opt">
                                          <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex-shrink-0" />
                                          <Input
                                            value={opt}
                                            onChange={(e) => {
                                              const newOptions = [...(editingField.field.options || [])];
                                              newOptions[optIndex] = e.target.value;
                                              updateField(group.id, field.id, { options: newOptions });
                                            }}
                                            className="flex-1 text-[14px] bg-zinc-100/50 dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none py-1.5 px-3 rounded-md h-9 transition-all shadow-none"
                                            placeholder={`Opção ${optIndex + 1}`}
                                          />
                                          <button
                                            onClick={() => {
                                              const newOptions = (editingField.field.options || []).filter(
                                                (_, i) => i !== optIndex,
                                              );
                                              updateField(group.id, field.id, { options: newOptions });
                                            }}
                                            className="w-6 h-6 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors opacity-0 group-hover/opt:opacity-100"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-3 mt-2">
                                        <div className="w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex-shrink-0" />
                                        <button
                                          className="text-[13px] font-medium text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 py-1"
                                          onClick={() => {
                                            const current = editingField.field.options || [];
                                            updateField(group.id, field.id, {
                                              options: [...current, `Opção ${current.length + 1}`],
                                            });
                                          }}
                                        >
                                          Adicionar opção ou adicionar "Outro"
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {(editingField.field.type === FieldType.TEXT ||
                                    editingField.field.type === FieldType.PHONE) && (
                                    <div className="space-y-2 mt-2 max-w-[200px]">
                                      <Label className="text-[12px] text-zinc-500">Máscara de entrada</Label>
                                      <Select
                                        value={editingField.field.mask || "none"}
                                        onChange={(e) =>
                                          updateField(group.id, field.id, { mask: e.target.value as any })
                                        }
                                      >
                                        <option value="none">Nenhuma</option>
                                        <option value="cpf">CPF</option>
                                        <option value="cnpj">CNPJ</option>
                                        <option value="phone">Telefone</option>
                                        <option value="cep">CEP</option>
                                        <option value="currency">Moeda (R$)</option>
                                        <option value="date">Data</option>
                                      </Select>
                                    </div>
                                  )}

                                  {editingField.field.type === FieldType.SCALE && (
                                    <div className="flex items-center gap-4 mt-2">
                                      <div className="space-y-2 max-w-[120px]">
                                        <Label className="text-[12px] text-zinc-500">Mínimo</Label>
                                        <Input
                                          type="number"
                                          value={editingField.field.scaleMin || 0}
                                          onChange={(e) =>
                                            updateField(group.id, field.id, { scaleMin: Number(e.target.value) })
                                          }
                                        />
                                        <Input
                                          placeholder="Rótulo Mínimo"
                                          value={editingField.field.scaleMinLabel || ""}
                                          onChange={(e) =>
                                            updateField(group.id, field.id, { scaleMinLabel: e.target.value })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-2 max-w-[120px]">
                                        <Label className="text-[12px] text-zinc-500">Máximo</Label>
                                        <Input
                                          type="number"
                                          value={editingField.field.scaleMax || 10}
                                          onChange={(e) =>
                                            updateField(group.id, field.id, { scaleMax: Number(e.target.value) })
                                          }
                                        />
                                        <Input
                                          placeholder="Rótulo Máximo"
                                          value={editingField.field.scaleMaxLabel || ""}
                                          onChange={(e) =>
                                            updateField(group.id, field.id, { scaleMaxLabel: e.target.value })
                                          }
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Bottom Toolbar */}
                                  <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-white/5">
                                    <button
                                      onClick={() => {
                                        const newField = { ...field, id: uuidv4() };
                                        const newFields = [...group.fields];
                                        newFields.splice(fIndex + 1, 0, newField);
                                        onChange(
                                          groups.map((g) => (g.id === group.id ? { ...g, fields: newFields } : g)),
                                        );
                                        setEditingField({ groupId: group.id, field: newField });
                                      }}
                                      className="p-2 w-9 h-9 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                                    >
                                      <Copy size={16} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setPendingDelete({
                                          type: "field",
                                          groupId: group.id,
                                          fieldId: field.id,
                                          label: field.label || "este campo",
                                        })
                                      }
                                      className="p-2 w-9 h-9 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                    <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1" />
                                    <div className="flex items-center gap-2">
                                      <Label className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
                                        Obrigatória
                                      </Label>
                                      <Switch
                                        checked={editingField.field.required}
                                        onCheckedChange={(c) => updateField(group.id, field.id, { required: c })}
                                      />
                                    </div>
                                    <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1" />
                                    <div className="flex-1" />
                                    <Button
                                      onClick={() => setEditingField(null)}
                                      variant="default"
                                      size="sm"
                                      className="h-9 rounded-md bg-primary hover:bg-primary/85 text-white text-[13px] font-semibold px-5 ml-2"
                                    >
                                      Concluído
                                    </Button>
                                  </div>

                                  {/* Simple Conditional Logic Widget */}
                                  <div className="pt-2">
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        if (editingField.field.dependsOn !== undefined) {
                                          updateField(group.id, field.id, {
                                            dependsOn: undefined,
                                            dependsOnValue: undefined,
                                          });
                                        } else {
                                          updateField(group.id, field.id, { dependsOn: "", dependsOnValue: "" });
                                        }
                                      }}
                                      className="h-8 text-[12px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                                    >
                                      {editingField.field.dependsOn !== undefined
                                        ? "Ocultar Lógica"
                                        : "+ Adicionar Lógica Condicional"}
                                    </Button>

                                    {editingField.field.dependsOn !== undefined && (
                                      <div className="mt-3 p-4 bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/10 rounded-xl flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle size={14} className="text-zinc-400" />
                                          <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                                            Mostrar este campo apenas se:
                                          </p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                          <Select
                                            value={editingField.field.dependsOn || ""}
                                            onChange={(e) =>
                                              updateField(group.id, field.id, {
                                                dependsOn: e.target.value,
                                                dependsOnValue: "",
                                              })
                                            }
                                            className="flex-1 bg-white dark:bg-black/20"
                                          >
                                            <option value="" disabled>
                                              1. Selecionar pergunta...
                                            </option>
                                            {groups
                                              .flatMap((g) => g.fields)
                                              .filter((f) => f.type === FieldType.SELECT && f.id !== field.id)
                                              .map((f) => (
                                                <option key={f.id} value={f.id}>
                                                  {f.label || "Sem nome"}
                                                </option>
                                              ))}
                                          </Select>
                                          <Select
                                            value={editingField.field.dependsOnValue || ""}
                                            onChange={(e) =>
                                              updateField(group.id, field.id, { dependsOnValue: e.target.value })
                                            }
                                            className="flex-1 bg-white dark:bg-black/20"
                                          >
                                            <option value="" disabled>
                                              2. Quando a resposta for...
                                            </option>
                                            {groups
                                              .flatMap((g) => g.fields)
                                              .find((f) => f.id === editingField.field.dependsOn)
                                              ?.options?.map((opt) => (
                                                <option key={opt} value={opt}>
                                                  {opt}
                                                </option>
                                              ))}
                                          </Select>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingField({ groupId: group.id, field });
                                  }}
                                  className={cn(
                                    "flex flex-col gap-2 px-6 py-4 cursor-pointer transition-all rounded-xl mx-3 my-1 bg-transparent hover:bg-zinc-50 dark:hover:bg-white/[0.02] border border-transparent relative group/ufield",
                                  )}
                                >
                                  <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[2px] opacity-0 group-hover/ufield:opacity-100 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 transition-opacity p-0.5">
                                    <GripHorizontal size={16} />
                                  </div>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/ufield:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDelete({
                                          type: "field",
                                          groupId: group.id,
                                          fieldId: field.id,
                                          label: field.label || "este campo",
                                        });
                                      }}
                                      className="w-8 h-8 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center transition-colors"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>

                                  <div className="flex-1 min-w-0 pr-12">
                                    <p className="text-[15px] font-semibold text-zinc-800 dark:text-zinc-200 mb-2 leading-snug">
                                      {field.label ? (
                                        renderFormattedText(field.label)
                                      ) : (
                                        <span className="text-zinc-400 italic">Pergunta sem título</span>
                                      )}
                                      {field.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      {field.type === FieldType.TEXT && (
                                        <div className="w-full md:w-2/3 xl:w-1/2 pointer-events-none">
                                          <Input
                                            placeholder={field.placeholder || "Sua resposta"}
                                            className="h-10 text-[14px] bg-zinc-50 border border-zinc-200/80 dark:bg-black/10 dark:border-white/10 text-zinc-500 shadow-sm transition-all"
                                            readOnly
                                            tabIndex={-1}
                                          />
                                        </div>
                                      )}
                                      {field.type === FieldType.TEXTAREA && (
                                        <div className="w-full xl:w-3/4 pointer-events-none">
                                          <Textarea
                                            placeholder={field.placeholder || "Sua resposta longa..."}
                                            className="text-[14px] min-h-[80px] bg-zinc-50 border border-zinc-200/80 dark:bg-black/10 dark:border-white/10 text-zinc-500 shadow-sm resize-none transition-all"
                                            readOnly
                                            tabIndex={-1}
                                          />
                                        </div>
                                      )}
                                      {field.type === FieldType.SELECT && (
                                        <div className="flex flex-col gap-3 w-full max-w-md pointer-events-none mt-1">
                                          {(field.options || []).map((o, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                              <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-zinc-300 dark:border-zinc-600 bg-white dark:bg-black/20" />
                                              <span className="text-[14.5px] text-zinc-700 dark:text-zinc-300 font-medium">
                                                {o}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {field.type === FieldType.SCALE && (
                                        <div className="flex items-center gap-4 w-full">
                                          <div className="flex items-center justify-between w-[200px]">
                                            <span className="text-[13px] text-zinc-500">{field.scaleMinLabel}</span>
                                            <div className="flex gap-1.5">
                                              {[...Array(5)].map((_, i) => (
                                                <div
                                                  key={i}
                                                  className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10"
                                                />
                                              ))}
                                            </div>
                                            <span className="text-[13px] text-zinc-500">{field.scaleMaxLabel}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                      {/* Add Field Button (Inside Group) */}
                      <div className="p-3 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.01]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-center h-12 text-[14px] font-semibold text-primary dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl gap-2 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
                            >
                              <Plus size={18} strokeWidth={2.5} /> Adicionar Pergunta / Campo
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="center"
                            className="w-56 rounded-[14px] shadow-xl border-zinc-200/60 dark:border-white/10 p-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl"
                          >
                            <DropdownMenuLabel className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1.5">
                              Tipos de Resposta
                            </DropdownMenuLabel>
                            {FIELD_TYPES.map((type) => (
                              <DropdownMenuItem
                                key={type.value}
                                onClick={() => addField(group.id, type.value)}
                                className="cursor-pointer py-2 rounded-md font-medium text-[13px] text-zinc-700 dark:text-zinc-300 focus:bg-zinc-100 dark:focus:bg-white/5 gap-2.5"
                              >
                                <type.icon size={15} className="text-zinc-500" /> {type.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Section */}
            <div className="pt-2">
              <Button
                onClick={addGroup}
                variant="outline"
                className="w-full h-12 rounded-[14px] text-[14px] font-semibold text-zinc-600 dark:text-zinc-300 border-2 border-dashed border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all gap-2"
              >
                <Plus size={16} strokeWidth={2.5} /> Nova Seção
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete?.type === "group" ? "Deletar seção?" : "Deletar campo?"}
        description={
          pendingDelete?.type === "group"
            ? `A seção "${pendingDelete?.label}" e todos os seus campos serão removidos.`
            : `O campo "${pendingDelete?.label}" será removido permanentemente.`
        }
        confirmLabel={pendingDelete?.type === "group" ? "Deletar seção" : "Deletar campo"}
        variant={pendingDelete?.type === "group" ? "danger" : "warning"}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.type === "group") {
            removeGroup(pendingDelete.groupId);
          } else if (pendingDelete.fieldId) {
            removeField(pendingDelete.groupId, pendingDelete.fieldId);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
}

// Simple internal Select component since we overwrote the imports
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-zinc-200/60 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-[13px] shadow-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 font-medium",
          className,
        )}
        {...props}
      />
    );
  },
);
Select.displayName = "Select";
