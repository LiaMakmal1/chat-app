import { useState } from "react";
import { authState } from "../state/authState";
import { Camera, Mail, User, Calendar, Shield } from "lucide-react";

const ProfileView = () => {
  const { authUser, isUpdatingProfile, updateProfile } = authState();
  const [img, setImg] = useState(null);

  const uploadImg = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Img = reader.result;
      setImg(base64Img);
      await updateProfile({ avatar: base64Img });
    };
  };

  return (
    <div className="min-h-screen pt-20 bg-base-100">
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-base-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-8">
            <h1 className="text-3xl font-bold text-center">Your Profile</h1>
          </div>

          <div className="p-8 space-y-10">
            {/* Avatar section */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="size-36 rounded-full overflow-hidden border-4 border-base-100 shadow-lg">
                  <img
                    src={img || authUser?.avatar || "/avatar.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <label
                  htmlFor="avatar-upload"
                  className={`
                    absolute bottom-2 right-2
                    bg-primary hover:bg-primary/90 hover:scale-105
                    p-3 rounded-full cursor-pointer shadow-md
                    transition-all duration-200
                    ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                  `}
                >
                  <Camera className="size-5 text-primary-content" />
                  <input
                    type="file"
                    id="avatar-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={uploadImg}
                    disabled={isUpdatingProfile}
                  />
                </label>
              </div>
              <p className="text-sm text-base-content/70 italic">
                {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
              </p>
            </div>

            {/* User information */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <User className="size-5" />
                  <h3 className="font-medium">Full Name</h3>
                </div>
                <div className="p-4 bg-base-100 rounded-lg shadow-sm border border-base-300">
                  {authUser?.fullName}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Mail className="size-5" />
                  <h3 className="font-medium">Email Address</h3>
                </div>
                <div className="p-4 bg-base-100 rounded-lg shadow-sm border border-base-300">
                  {authUser?.email}
                </div>
              </div>
            </div>

            {/* Account information */}
            <div className="bg-base-100 rounded-xl p-6 shadow-sm border border-base-300">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                Account Information
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-base-content/70" />
                    <span>Member Since</span>
                  </div>
                  <span className="font-medium">{authUser?.createdAt?.split("T")[0]}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span>Account Status</span>
                  <span className="px-3 py-1 bg-success/20 text-success rounded-full text-sm font-medium">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileView;
