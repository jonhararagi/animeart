package com.jonhararagi.animeart.editor

interface EditorCommand {
    fun execute()
    fun undo()
}

class CommandHistory(private val limit: Int = 100) {
    private val undoStack = ArrayDeque<EditorCommand>()
    private val redoStack = ArrayDeque<EditorCommand>()

    fun execute(command: EditorCommand) {
        command.execute()
        undoStack.addLast(command)
        if (undoStack.size > limit) undoStack.removeFirst()
        redoStack.clear()
    }

    fun undo() {
        val command = undoStack.removeLastOrNull() ?: return
        command.undo()
        redoStack.addLast(command)
    }

    fun redo() {
        val command = redoStack.removeLastOrNull() ?: return
        command.execute()
        undoStack.addLast(command)
    }
}
