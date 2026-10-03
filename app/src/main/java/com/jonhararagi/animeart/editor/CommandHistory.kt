package com.jonhararagi.animeart.editor

interface EditorCommand { fun execute(); fun undo() }
class CommandHistory(private val limit: Int = 100) {
    private val undoStack = ArrayDeque<EditorCommand>()
    private val redoStack = ArrayDeque<EditorCommand>()
    fun execute(command: EditorCommand) { command.execute(); undoStack.addLast(command); if (undoStack.size > limit) undoStack.removeFirst(); redoStack.clear() }
    fun undo() { val c = undoStack.removeLastOrNull() ?: return; c.undo(); redoStack.addLast(c) }
    fun redo() { val c = redoStack.removeLastOrNull() ?: return; c.execute(); undoStack.addLast(c) }
    fun canUndo() = undoStack.isNotEmpty()
    fun canRedo() = redoStack.isNotEmpty()
}
