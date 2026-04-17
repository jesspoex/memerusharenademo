"use client";

import { useEffect, useCallback } from 'react';

export function useBattleNotifications() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const sendNotification = useCallback((title: string, body: string, icon?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/icon.png',
        badge: '/badge.png',
        requireInteraction: false,
      });
    }
  }, []);

  const sendBattleStartNotification = useCallback((roundId: number) => {
    sendNotification(
      '🔥 New Round Starting!',
      `Round #${roundId} is about to begin. Place your bets now!`,
    );
  }, [sendNotification]);

  const sendBattleEndNotification = useCallback((roundId: number, winner: string) => {
    sendNotification(
      '🏆 Round Ended!',
      `Round #${roundId} winner: ${winner}`,
    );
  }, [sendNotification]);

  const sendPriceAlertNotification = useCallback((token: string, price: number, change: number) => {
    sendNotification(
      `📊 ${token} Price Alert`,
      `${token} is now $${price.toFixed(6)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`,
    );
  }, [sendNotification]);

  return {
    sendNotification,
    sendBattleStartNotification,
    sendBattleEndNotification,
    sendPriceAlertNotification,
  };
}
