export function statusChangeNotification(
  jobTitle: string,
  statusLabel: string,
): { message: string; link: string } {
  return {
    message: `Đơn ứng tuyển "${jobTitle}" đã chuyển sang "${statusLabel}"`,
    link: "/applications",
  };
}

export function newMessageNotification(
  senderName: string,
  jobTitle: string,
  applicationId: string,
): { message: string; link: string } {
  return {
    message: `${senderName} đã nhắn tin cho bạn về "${jobTitle}"`,
    link: `/messages/${applicationId}`,
  };
}

export function newApplicationNotification(
  candidateName: string,
  jobTitle: string,
  jobId: string,
): { message: string; link: string } {
  return {
    message: `${candidateName} đã ứng tuyển "${jobTitle}"`,
    link: `/jobs/${jobId}/applicants`,
  };
}
