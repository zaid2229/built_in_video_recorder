import frappe
from PIL import Image
from fpdf import FPDF
import os
import io
from frappe import _

@frappe.whitelist()
def generate_pdf_from_folder(folder_name):
    try:
        # Define the folder path in ERPNext File Doctype
        folder_path = frappe.get_site_path("private", "files", folder_name)

        frappe.logger().info(f"Folder path: {folder_path}")

        if not os.path.exists(folder_path):
            frappe.throw(f"Folder {folder_path} does not exist.")

        # Retrieve all image files in the folder using Frappe ORM
        file_records = frappe.get_all('File', fields=['file_name', 'file_url'], filters={'folder': f'Home/{folder_name}'})
        print(file_records)

        image_files = []
        for file_record in file_records:
            file_url = file_record['file_url']
            if file_url.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_files.append(frappe.get_site_path(file_url.lstrip('/')))

        if not image_files:
            frappe.throw(f"No image files found in the folder {folder_path}.")

        # Sort the image files to ensure they are processed in a consistent order
        image_files.sort()

        # Create a PDF from the image files in landscape mode
        pdf = FPDF(orientation='L', unit='mm', format='A4')
        for image_file in image_files:
            pdf.add_page()
            # Adjust positioning to fit landscape mode
            pdf.image(image_file, 10, 10, 277)  # 277mm is the width of an A4 page in landscape

        # Generate PDF in memory
        pdf_output = io.BytesIO()
        pdf_output_path = "/tmp/temp_pdf_output.pdf"
        pdf.output(pdf_output_path)

        # Read the PDF file into the BytesIO object
        with open(pdf_output_path, 'rb') as f:
            pdf_output.write(f.read())
        pdf_output.seek(0)

        # Send the PDF as a file download response
        frappe.local.response.filename = f"{folder_name}_Images.pdf"
        frappe.local.response.filecontent = pdf_output.read()
        frappe.local.response.type = "download"

    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="Error in generate_pdf_from_folder")
        frappe.throw(_("There was an error generating the PDF. Please check the logs for more details."))
