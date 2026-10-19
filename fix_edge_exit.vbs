Dim fso, f, path, content
Set fso = CreateObject("Scripting.FileSystemObject")
path = Environ("LOCALAPPDATA") & "\Microsoft\Edge\User Data\Default\Preferences"
If fso.FileExists(path) Then
    Set f = fso.OpenTextFile(path, 1)
    content = f.ReadAll
    f.Close
    content = Replace(content, """exit_type"":""Crashed""", """exit_type"":""Normal""")
    Set f = fso.CreateTextFile(path, True)
    f.Write content
    f.Close
End If
