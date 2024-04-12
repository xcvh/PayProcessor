import os
import shutil
import tempfile
import PySimpleGUI as sg
from segno import helpers

# Read empty QR Code
displayedcode = 'empty.png'

# Define function to validate amount is a float
def validate_float(amount):
    try:
        float(amount) if '.' in amount else int(amount)
        return True
    except ValueError:
        return False

# Create QR Code

def create_qr(name, iban, amount, text):
    qrcode = helpers.make_epc_qr(name=name,
                                 iban=iban,
                                 amount=amount,
                                 text=text)
    f = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
    qrcode.save(f.name, scale=10)
    f.close
    return f.name

# Create layout
layout = [[sg.Text('Welcome to PayPyQR')],
          [sg.Text("Name:", size=(15, 1)), sg.InputText(key='name')],
          [sg.Text("IBAN:", size=(15, 1)), sg.InputText(key='iban')],
          [sg.Text("Amount:", size=(15, 1)), sg.InputText(key='amount', enable_events=True)],
          [sg.Text("Reference Text:", size=(15, 1)), sg.InputText(key='text')],
          [sg.Button('Generate EPC QR Code')],
          [sg.Image(filename=displayedcode, key='image')],
          [sg.Button('Close'), sg.Button('Save')]]


# Create the window
window = sg.Window('PayPyQR', layout, grab_anywhere=True)

# Create the event loop
while True:    
    event, values = window.read()

    if event in [sg.WIN_CLOSED, 'Close']:    
        break

    if event == 'amount':
        if not validate_float(values['amount']):
            window['amount'].Update('')

    if event == 'Generate EPC QR Code':
        name = values['name']
        iban = values['iban']
        amount = round(float(values['amount']), 2)
        text = values['text']
        displayedcode = create_qr(name, iban, amount, text)
        window['image'].Update(displayedcode)

    if event == 'Save':
        qr_name = values['name'] + ' (PayPyQR).png'
        save_path = os.path.join(os.getcwd(), qr_name)
        save_location = sg.popup_get_file('Save to', save_as=True,
                                          default_path=save_path,
                                          default_extension='png',
                                          file_types=[('PNG','*.png')])
        if save_location:
            shutil.copy(displayedcode, save_location)

window.close()