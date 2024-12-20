
import pandas as pd
import requests
from pathlib import Path

def parse_excel(file_path):
    """Parse the Excel file to extract relevant data."""
    df = pd.read_excel(file_path, header=2)
    return df[df['Invoice (attachment)'].notna()]

def organize_files(base_dir, year, area):
    """Create and return paths for year and area-specific directories."""
    year_dir = Path(base_dir) / str(year)
    area_dir = year_dir / str(area).replace('/', '-')
    area_dir.mkdir(parents=True, exist_ok=True)
    return area_dir

def download_file(url, destination):
    """Download a file from a URL to a specified destination."""
    response = requests.get(url, allow_redirects=True)
    if response.status_code == 200:
        with open(destination, 'wb') as file:
            file.write(response.content)
        return True
    else:
        return False

def process_excel(
    file_path,
    output_dir,
    organize_by='Year/Area'
):
    """
    Process an Excel file to download and organize files.

    Args:
        file_path (str): Path to the input Excel file.
        output_dir (str): Base directory for downloads.
        organize_by (str): Organization strategy ('Year/Area', 'Area/Year', 'Year', 'Area').
    """
    df = parse_excel(file_path)
    processed_files = set()

    for _, row in df.iterrows():
        task = row['Task Name']
        link = row['Invoice (attachment)']
        pr = row['Payment Reference (short text)']
        area = str(row['Area (drop down)'])
        year = pd.Timestamp(row['Due Date']).year

        # Determine file organization
        if organize_by == 'Year/Area':
            dest_dir = organize_files(output_dir, year, area)
        elif organize_by == 'Area/Year':
            dest_dir = organize_files(output_dir, area, year)
        elif organize_by == 'Year':
            dest_dir = Path(output_dir) / str(year)
            dest_dir.mkdir(parents=True, exist_ok=True)
        elif organize_by == 'Area':
            dest_dir = Path(output_dir) / str(area).replace('/', '-')
            dest_dir.mkdir(parents=True, exist_ok=True)
        else:
            raise ValueError("Invalid organization strategy.")

        # Generate the file name
        file_name = f"{task}_{pr}".replace(' ', '_').replace('-', '').replace('.', '').replace('__', '_') + '.pdf'
        file_path = dest_dir / file_name

        # Skip duplicates
        if file_path in processed_files:
            print(f"Skipping duplicate file: {file_path}")
            continue

        # Download file
        try:
            success = download_file(link, file_path)
            if success:
                processed_files.add(file_path)
                print(f"Downloaded: {file_name} to {dest_dir}")
            else:
                print(f"Failed to download: {file_name}")
        except Exception as e:
            print(f"Error downloading {file_name}: {e}")

    print("Download process completed!")
