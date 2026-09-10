from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.core.auth import get_current_user
from app.core.permissions import require_workspace_owner, require_workspace_member, require_form_write
from app.services import db as firestore_db

router = APIRouter()


class FolderCreate(BaseModel):
    name: str


class FormFolderAssign(BaseModel):
    folderId: Optional[str] = None


@router.get("/workspaces/{workspace_id}/folders")
async def list_folders(workspace_id: str, current_user: dict = Depends(get_current_user)):
    await require_workspace_member(workspace_id, current_user)
    try:
        folders = await firestore_db.get_folders_by_workspace(workspace_id)
        return folders
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workspaces/{workspace_id}/folders", status_code=status.HTTP_201_CREATED)
async def create_folder(
    workspace_id: str,
    body: FolderCreate,
    current_user: dict = Depends(get_current_user),
):
    ws = await require_workspace_owner(workspace_id, current_user)
    try:
        folder = await firestore_db.create_folder({
            "name": body.name,
            "workspaceId": workspace_id,
            "ownerId": ws.get("ownerId"),
        })
        return folder
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    folder = await firestore_db.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pasta não encontrada")
    await require_workspace_owner(folder["workspaceId"], current_user)
    await firestore_db.delete_folder(folder_id)


@router.patch("/forms/{form_id}/folder")
async def assign_form_to_folder(
    form_id: str,
    body: FormFolderAssign,
    current_user: dict = Depends(get_current_user),
):
    await require_form_write(form_id, current_user, min_role="admin")
    try:
        updated = await firestore_db.update_form(form_id, {"folderId": body.folderId})
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
