import PySimpleGUI as sg
fro

layout = [[sg.Text("Welcome to PayPyQR")], [sg.Button("OK")]]

# Create the window
window = sg.Window("Demo", layout)

# Create the event loop
while True:
    event, values = window.read()
    # End program if user closes window or presses OK
    if event == "OK" or event == sg.WIN_CLOSED:
        break

window.close()