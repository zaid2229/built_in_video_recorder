import frappe
from PIL import Image, ImageDraw, ImageFont
from pdf2image import convert_from_path
import os

@frappe.whitelist()
def generate_certificate(docname):
    try:
        # Fetch the student details from the provided docname
        student_details = frappe.get_doc('Student Complete Progress', docname)
        student_name = student_details.student_name2
        completion_date = "2024-08-03"  # Hardcoded for testing
        customer_no = student_details.cluster_no  # Assuming a fixed cluster number for testing
        masjid = student_details.masjid_name

        # Fetch the certificate template based on the cluster_no
        template_file_url = f"/private/files/Cluster 1.pdf"
        template_file_path = frappe.get_site_path(template_file_url.lstrip('/'))

        # Debugging information
        frappe.logger().info(f"Template file path: {template_file_path}")

        if not os.path.exists(template_file_path):
            frappe.throw(f"Template file {template_file_path} does not exist.")

        # Convert the PDF to an image
        images = convert_from_path(template_file_path)
        image = images[0]  # Assuming the template is a single-page PDF
        draw = ImageDraw.Draw(image)

        # Define font and size (You may need to provide the path to a TTF font file)
        font_path = frappe.get_site_path("private", "files", "Merriweather-Italic.ttf")
        font = ImageFont.truetype(font_path, 40)

        # Define text position (Adjust according to your template)
        name_position = (1000, 930)  # Example position
        date_position = (500, 400)  # Example position

        # Add the student's name and completion date to the image
        draw.text(name_position, student_name, font=font, fill="black")
        draw.text(date_position, completion_date, font=font, fill="black")

        # Define the new folder path in ERPNext File Doctype
        new_folder_name = f"Cluster {customer_no}"
        new_subfolder_name = masjid
        new_folder_path = frappe.get_site_path("private", "files", new_folder_name)
        new_subfolder_path = frappe.get_site_path("private", "files", new_folder_name, new_subfolder_name)

        # Ensure the folders exist
        os.makedirs(new_subfolder_path, exist_ok=True)

        # Save the edited image
        new_file_name = f"Certificate_{docname}.jpg"
        new_file_path = os.path.join(new_subfolder_path, new_file_name)
        image.save(new_file_path)

        # Ensure the parent folder exists in the File Doctype
        if not frappe.db.exists("File", {"file_name": new_folder_name, "folder": "Home"}):
            parent_folder = frappe.get_doc({
                "doctype": "File",
                "file_name": new_folder_name,
                "folder": "Home",
                "is_folder": 1
            })
            parent_folder.insert()
        else:
            parent_folder = frappe.get_doc("File", {"file_name": new_folder_name, "folder": "Home"})

        # Ensure the subfolder exists in the File Doctype
        if not frappe.db.exists("File", {"file_name": new_subfolder_name, "folder": parent_folder.name}):
            subfolder = frappe.get_doc({
                "doctype": "File",
                "file_name": new_subfolder_name,
                "folder": parent_folder.name,
                "is_folder": 1
            })
            subfolder.insert()
        else:
            subfolder = frappe.get_doc("File", {"file_name": new_subfolder_name, "folder": parent_folder.name})

        # Create a new File document for the generated certificate
        new_file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": new_file_name,
            "file_url": f"/private/files/{new_folder_name}/{new_subfolder_name}/{new_file_name}",
            "folder": subfolder.name,
            "is_private": 1
        })
        new_file_doc.insert()

        return new_file_doc.file_url

    except Exception as e:
        frappe.log_error(message=frappe.get_traceback(), title="Error in generate_certificate")
        frappe.throw("There was an error generating the certificate. Please check the logs for more details.")
